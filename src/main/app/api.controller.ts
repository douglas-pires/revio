import { type ApiMethod, IPC, type RevioApi } from '@shared/api.contract.ts'
import type { AskActivity, BriefingRecord } from '@shared/claude.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { ipcMain, shell } from 'electron'
import { sendTestNotification } from '../alerts/notification.service.ts'
import { ask } from '../claude/ask.service.ts'
import { generateBriefing } from '../claude/briefing.service.ts'
import { InFlight } from '../common/in-flight.util.ts'
import { isWebUrl } from '../common/web-url.util.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { listInstalledEditors } from '../editor/editor.service.ts'
import { buildFeedbackApi } from '../feedback/feedback.api.ts'
import { getGithubClient, resetClient } from '../github/github.client.ts'
import type { GithubTokens } from '../github/github-tokens.service.ts'
import { buildGitLogApi } from '../gitlog/git-log.api.ts'
import { buildGuidelinesApi } from '../guidelines/guidelines.api.ts'
import { resolveGuidelines } from '../guidelines/guidelines.service.ts'
import type { HistoryCache } from '../history/history.cache.ts'
import type { InboxPoller } from '../inbox/inbox.poller.ts'
import type { MentionWatcher } from '../mentions/mentions.watcher.ts'
import type { PullCache } from '../pulls/pull.cache.ts'
import { fetchFileAt } from '../pulls/pull.service.ts'
import { commentOnPull, replyToComment, submitReview } from '../pulls/review-submit.service.ts'
import { setReaction } from '../reactions/reactions.service.ts'
import { fetchStackComments } from '../stacks/stack-comments.service.ts'
import { fetchStack } from '../stacks/stacks.service.ts'
import type { store as appStore } from '../store/store.service.ts'
import type { IcloudSync } from '../sync/icloud-sync.service.ts'
import type { ThreadCache } from '../threads/threads.cache.ts'
import { replyToThread, setThreadResolved } from '../threads/threads.service.ts'
import type { ReleaseSource } from '../updates/release.util.ts'
import type { UpdatePoller } from '../updates/update.poller.ts'
import type { AppWindow } from './app.window.ts'

type ApiHandlers = {
  [K in ApiMethod]: (...args: Parameters<RevioApi[K]>) => ReturnType<RevioApi[K]> | Awaited<ReturnType<RevioApi[K]>>
}

const INBOX_SETTINGS: readonly string[] = ['githubToken', 'includeTeamRequests', 'ignoreDrafts', 'staleAfterHours']

type SettingsMethods =
  | 'getSettings'
  | 'updateSettings'
  | 'githubAuthStatus'
  | 'saveGithubToken'
  | 'getSyncStatus'
  | 'syncNow'

function buildSettingsHandlers({ store, tokens, poller, sync }: ApiDeps): Pick<ApiHandlers, SettingsMethods> {
  return {
    getSettings: () => store.settings(),
    updateSettings: (patch) => {
      store.updateSettings(patch)
      applySettingsChanges(
        poller,
        Object.keys(patch).filter((key) => patch[key as keyof typeof patch] !== undefined),
      )
      if (patch.syncViaIcloud !== undefined) {
        sync.refresh()
      }
      return store.settings()
    },
    getSyncStatus: () => sync.status,
    syncNow: () => sync.syncNow(),
    githubAuthStatus: () => tokens.describe(),
    saveGithubToken: async (token) => {
      await tokens.verifyAndSave(token)
      resetClient()
      poller.poll()
      return tokens.describe()
    },
  }
}

type InboxMethods =
  | 'getInbox'
  | 'refreshInbox'
  | 'getMentions'
  | 'refreshMentions'
  | 'markMentionRead'
  | 'getThreads'
  | 'replyToThread'
  | 'setThreadResolved'

function buildInboxHandlers({ poller, mentions, threads }: ApiDeps): Pick<ApiHandlers, InboxMethods> {
  return {
    getInbox: () => poller.latest,
    refreshInbox: () => poller.poll(),
    getMentions: () => mentions.latest ?? mentions.refresh(),
    refreshMentions: () => mentions.refresh(),
    markMentionRead: (ref) => mentions.markRead(ref),
    getThreads: (maxAgeMs = 0) => threads.get(maxAgeMs),
    replyToThread: async (threadId, body) => {
      const comment = await replyToThread(await getGithubClient(), threadId, body)
      threads.forget()
      return comment
    },
    setThreadResolved: async (threadId, resolved) => {
      await setThreadResolved(await getGithubClient(), threadId, resolved)
      threads.forget()
    },
  }
}

type PullMethods =
  | 'getPull'
  | 'getStack'
  | 'getStackComments'
  | 'getLocalState'
  | 'saveDrafts'
  | 'setViewed'
  | 'submitReview'
  | 'replyToComment'
  | 'setReaction'
  | 'commentOnPull'
  | 'saveAsks'

function buildPullHandlers({ store, poller, pulls }: ApiDeps): Pick<ApiHandlers, PullMethods> {
  return {
    getPull: (ref, maxAgeMs = 0) => pulls.get(ref, maxAgeMs),
    getStack: (ref) => fetchStack(ref, poller.latest),
    getStackComments: (stack) => fetchStackComments(stack),
    getLocalState: (ref) => store.pull(buildPullKey(ref)),
    saveDrafts: (ref, drafts) =>
      store.updatePull(buildPullKey(ref), (pullState) => {
        pullState.drafts = drafts
      }),
    setViewed: (ref, path, sha) =>
      store.updatePull(buildPullKey(ref), (pullState) => {
        if (sha) {
          pullState.viewed[path] = sha
        } else {
          delete pullState.viewed[path]
        }
      }),
    submitReview: async (input) => {
      const key = buildPullKey(input)
      const result = await submitReview(input, store.pull(key).drafts)
      store.updatePull(key, (pullState) => {
        pullState.drafts = []
      })
      // The review changed the PR; the next open should fetch it fresh.
      pulls.forget(input)
      poller.poll()
      return result
    },
    replyToComment: (ref, id, body) => replyToComment(ref, id, body),
    commentOnPull: (ref, body) => commentOnPull(ref, body),
    setReaction: async (ref, subjectId, content, on) => {
      const reactions = await setReaction(await getGithubClient(), subjectId, content, on)
      pulls.forget(ref)
      return reactions
    },
    saveAsks: (ref, asks) =>
      store.updatePull(buildPullKey(ref), (pullState) => {
        pullState.asks = asks
      }),
  }
}

type HistoryMethods =
  | 'getBlame'
  | 'getFileHistory'
  | 'getCommitFilePatch'
  | 'getCommitFiles'
  | 'getPullCommits'
  | 'getFileContent'

function buildHistoryHandlers({ history }: ApiDeps): Pick<ApiHandlers, HistoryMethods> {
  return {
    getBlame: (at) => history.blame(at),
    getFileHistory: (ref, at) => history.fileHistory(ref, at),
    getCommitFilePatch: (at) => history.commitFilePatch(at),
    getCommitFiles: (at) => history.commitFiles(at),
    getPullCommits: (ref, headSha) => history.pullCommits(ref, headSha),
    getFileContent: (at) => fetchFileAt(at.repo, at.sha, at.path),
  }
}

function buildClaudeHandlers({ store, pulls, window }: ApiDeps): Pick<ApiHandlers, 'generateBriefing' | 'askClaude'> {
  /** The PR (cached if recent) and the review guides that apply to its files. */
  const loadContext = async (ref: PullRef) => {
    const pr = pulls.peek(ref) ?? (await pulls.get(ref))
    return {
      pr,
      guidelines: resolveGuidelines(
        ref.repo,
        pr.files.map((file) => file.path),
      ),
    }
  }
  const briefings = new InFlight<BriefingRecord>()
  const writeBriefing = async (ref: PullRef) => {
    const key = buildPullKey(ref)
    const { pr, guidelines } = await loadContext(ref)
    const record = await generateBriefing(pr, guidelines, (message) =>
      window.send({ type: 'briefing-progress', key, message }),
    )
    store.updatePull(key, (pullState) => {
      pullState.briefing = record
    })
    return record
  }
  return {
    // One request per PR: asking again while it runs (after a reload, say) waits for the same briefing.
    generateBriefing: (ref) => briefings.run(buildPullKey(ref), () => writeBriefing(ref)),
    askClaude: async (ref, thread) => {
      const onActivity = (activity: AskActivity) => window.send({ type: 'ask-activity', threadId: thread.id, activity })
      onActivity({ kind: 'step', label: 'Loading the PR and your review guides' })
      const { pr, guidelines } = await loadContext(ref)
      const output = {
        onText: (text: string) => window.send({ type: 'ask-delta', threadId: thread.id, text }),
        onActivity,
      }
      return { answer: await ask({ pr, guidelines, briefing: store.pull(buildPullKey(ref)).briefing, thread }, output) }
    },
  }
}

export interface ApiDeps {
  store: typeof appStore
  tokens: GithubTokens
  poller: InboxPoller
  pulls: PullCache
  history: HistoryCache
  updates: UpdatePoller
  threads: ThreadCache
  mentions: MentionWatcher
  editor: EditorService
  sync: IcloudSync
  window: AppWindow
  /** Revio's own repository: where feedback goes. */
  releaseSource: ReleaseSource | null
}

/** Answers renderer calls on the single IPC channel by delegating to the services. */
export function registerApi(deps: ApiDeps) {
  const handlers: ApiHandlers = {
    ...buildSettingsHandlers(deps),
    ...buildInboxHandlers(deps),
    ...buildPullHandlers(deps),
    ...buildHistoryHandlers(deps),
    getUpdateStatus: () => deps.updates.status,
    checkForUpdates: () => deps.updates.check(),
    testNotification: () => sendTestNotification(() => deps.window.show()),
    ...buildGuidelinesApi(deps.store, deps.poller),
    ...buildClaudeHandlers(deps),
    ...buildGitLogApi(),
    ...buildFeedbackApi(deps.releaseSource),
    listEditors: () => listInstalledEditors(),
    openInEditor: (target) => deps.editor.open(target),
    openExternal: async (url) => {
      if (isWebUrl(url)) {
        await shell.openExternal(url)
      }
    },
  }
  ipcMain.handle(IPC.invoke, (_event, method: ApiMethod, args: unknown[]) => {
    // Calls act with the user's GitHub token, so only the app's own page may make them.
    if (!deps.window.isAppPage(_event.senderFrame?.url)) {
      throw new Error('Revio only answers calls from its own window.')
    }
    // Own keys only, so a name like "constructor" cannot reach Object.prototype.
    if (!Object.hasOwn(handlers, method)) {
      throw new Error(`Unknown method ${method}`)
    }
    const handler = handlers[method] as (...a: unknown[]) => unknown
    return handler(...args)
  })
}

/** Lets the inbox catch up with changed settings, whether changed here or synced from another Mac. */
export function applySettingsChanges(poller: Pick<InboxPoller, 'reschedule' | 'poll'>, changed: readonly string[]) {
  if (changed.includes('githubToken')) {
    resetClient()
  }
  if (changed.includes('pollIntervalMinutes')) {
    poller.reschedule()
  }
  if (changed.some((key) => INBOX_SETTINGS.includes(key))) {
    poller.poll()
  }
}
