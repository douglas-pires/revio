import { type ApiMethod, IPC, type RevioApi } from '@shared/api.contract.ts'
import { type PullRef, pullKey } from '@shared/pull.types.ts'
import { ipcMain, shell } from 'electron'
import { ask } from '../claude/ask.service.ts'
import { generateBriefing } from '../claude/briefing.service.ts'
import { isWebUrl } from '../common/web-url.util.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { installedEditors } from '../editor/editor.service.ts'
import { gh, resetClient } from '../github/github.client.ts'
import type { GithubTokens } from '../github/github-tokens.service.ts'
import { deleteGuideline, resolveGuidelines, saveGuideline } from '../guidelines/guidelines.service.ts'
import type { HistoryCache } from '../history/history.cache.ts'
import type { InboxPoller } from '../inbox/inbox.poller.ts'
import type { MentionWatcher } from '../mentions/mentions.watcher.ts'
import type { PullCache } from '../pulls/pull.cache.ts'
import { commentOnPull, fetchFileAt, replyToComment, submitReview } from '../pulls/pull.service.ts'
import { setReaction } from '../reactions/reactions.service.ts'
import { fetchStack } from '../stacks/stacks.service.ts'
import type { store as appStore } from '../store/store.service.ts'
import type { ThreadCache } from '../threads/threads.cache.ts'
import { replyToThread, setThreadResolved } from '../threads/threads.service.ts'
import type { UpdatePoller } from '../updates/update.poller.ts'
import type { AppWindow } from './app.window.ts'

type ApiHandlers = {
  [K in ApiMethod]: (...args: Parameters<RevioApi[K]>) => ReturnType<RevioApi[K]> | Awaited<ReturnType<RevioApi[K]>>
}

const INBOX_SETTINGS = ['githubToken', 'includeTeamRequests', 'ignoreDrafts', 'staleAfterHours'] as const

function settingsHandlers({
  store,
  tokens,
  poller,
}: ApiDeps): Pick<ApiHandlers, 'getSettings' | 'updateSettings' | 'githubAuthStatus' | 'saveGithubToken'> {
  return {
    getSettings: () => store.settings(),
    updateSettings: (patch) => {
      store.updateSettings(patch)
      if (patch.githubToken !== undefined) {
        resetClient()
      }
      if (patch.pollIntervalMinutes !== undefined) {
        poller.reschedule()
      }
      if (INBOX_SETTINGS.some((key) => patch[key] !== undefined)) {
        poller.poll()
      }
      return store.settings()
    },
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

function inboxHandlers({ poller, mentions, threads }: ApiDeps): Pick<ApiHandlers, InboxMethods> {
  return {
    getInbox: () => poller.latest,
    refreshInbox: () => poller.poll(),
    getMentions: () => mentions.latest ?? mentions.refresh(),
    refreshMentions: () => mentions.refresh(),
    markMentionRead: (ref) => mentions.markRead(ref),
    getThreads: (maxAgeMs = 0) => threads.get(maxAgeMs),
    replyToThread: async (threadId, body) => {
      const comment = await replyToThread(await gh(), threadId, body)
      threads.forget()
      return comment
    },
    setThreadResolved: async (threadId, resolved) => {
      await setThreadResolved(await gh(), threadId, resolved)
      threads.forget()
    },
  }
}

type PullMethods =
  | 'getPull'
  | 'getStack'
  | 'getLocalState'
  | 'saveDrafts'
  | 'setViewed'
  | 'submitReview'
  | 'replyToComment'
  | 'setReaction'
  | 'commentOnPull'
  | 'saveAsks'

function pullHandlers({ store, poller, pulls }: ApiDeps): Pick<ApiHandlers, PullMethods> {
  return {
    getPull: (ref, maxAgeMs = 0) => pulls.get(ref, maxAgeMs),
    getStack: (ref) => fetchStack(ref, poller.latest),
    getLocalState: (ref) => store.pull(pullKey(ref)),
    saveDrafts: (ref, drafts) =>
      store.updatePull(pullKey(ref), (s) => {
        s.drafts = drafts
      }),
    setViewed: (ref, path, sha) =>
      store.updatePull(pullKey(ref), (s) => {
        if (sha) {
          s.viewed[path] = sha
        } else {
          delete s.viewed[path]
        }
      }),
    submitReview: async (input) => {
      const key = pullKey(input)
      const result = await submitReview(input, store.pull(key).drafts)
      store.updatePull(key, (s) => {
        s.drafts = []
      })
      // The review changed the PR; the next open should fetch it fresh.
      pulls.forget(input)
      poller.poll()
      return result
    },
    replyToComment: (ref, id, body) => replyToComment(ref, id, body),
    commentOnPull: (ref, body) => commentOnPull(ref, body),
    setReaction: async (ref, subjectId, content, on) => {
      const reactions = await setReaction(await gh(), subjectId, content, on)
      pulls.forget(ref)
      return reactions
    },
    saveAsks: (ref, asks) =>
      store.updatePull(pullKey(ref), (s) => {
        s.asks = asks
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

function historyHandlers({ history }: ApiDeps): Pick<ApiHandlers, HistoryMethods> {
  return {
    getBlame: (at) => history.blame(at),
    getFileHistory: (ref, at) => history.fileHistory(ref, at),
    getCommitFilePatch: (at) => history.commitFilePatch(at),
    getCommitFiles: (at) => history.commitFiles(at),
    getPullCommits: (ref, headSha) => history.pullCommits(ref, headSha),
    getFileContent: (at) => fetchFileAt(at.repo, at.sha, at.path),
  }
}

function guidelineHandlers({
  store,
  poller,
}: ApiDeps): Pick<
  ApiHandlers,
  'listGuidelines' | 'saveGuideline' | 'deleteGuideline' | 'resolveGuidelines' | 'knownRepos'
> {
  return {
    listGuidelines: () => store.guidelines(),
    saveGuideline: (g) => saveGuideline(g),
    deleteGuideline: (id) => deleteGuideline(id),
    resolveGuidelines: (repo, paths) => resolveGuidelines(repo, paths),
    knownRepos: () => {
      const inbox = poller.latest
      const repos = new Set(
        store
          .guidelines()
          .map((g) => g.repo)
          .filter((r) => r !== '*'),
      )
      for (const p of [...(inbox?.requested ?? []), ...(inbox?.reviewed ?? [])]) {
        repos.add(p.repo)
      }
      return [...repos].sort((a, b) => a.localeCompare(b))
    },
  }
}

function claudeHandlers({ store, pulls, window }: ApiDeps): Pick<ApiHandlers, 'generateBriefing' | 'askClaude'> {
  /** The PR (cached if recent) and the review guides that apply to its files. */
  const loadContext = async (ref: PullRef) => {
    const pr = pulls.peek(ref) ?? (await pulls.get(ref))
    return {
      pr,
      guidelines: resolveGuidelines(
        ref.repo,
        pr.files.map((f) => f.path),
      ),
    }
  }
  return {
    generateBriefing: async (ref) => {
      const key = pullKey(ref)
      const { pr, guidelines } = await loadContext(ref)
      const record = await generateBriefing(pr, guidelines, (message) =>
        window.send({ type: 'briefing-progress', key, message }),
      )
      store.updatePull(key, (s) => {
        s.briefing = record
      })
      return record
    },
    askClaude: async (ref, thread) => {
      const { pr, guidelines } = await loadContext(ref)
      const onDelta = (text: string) => window.send({ type: 'ask-delta', threadId: thread.id, text })
      return { answer: await ask({ pr, guidelines, briefing: store.pull(pullKey(ref)).briefing, thread }, onDelta) }
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
  window: AppWindow
}

/** Answers renderer calls on the single IPC channel by delegating to the services. */
export function registerApi(deps: ApiDeps) {
  const handlers: ApiHandlers = {
    ...settingsHandlers(deps),
    ...inboxHandlers(deps),
    ...pullHandlers(deps),
    ...historyHandlers(deps),
    getUpdateStatus: () => deps.updates.status,
    checkForUpdates: () => deps.updates.check(),
    ...guidelineHandlers(deps),
    ...claudeHandlers(deps),
    listEditors: () => installedEditors(),
    openInEditor: (target) => deps.editor.open(target),
    openExternal: async (url) => {
      if (isWebUrl(url)) {
        await shell.openExternal(url)
      }
    },
  }
  ipcMain.handle(IPC.invoke, (e, method: ApiMethod, args: unknown[]) => {
    // Calls act with the user's GitHub token, so only the app's own page may make them.
    if (!deps.window.isAppPage(e.senderFrame?.url)) {
      throw new Error('Revio only answers calls from its own window.')
    }
    // Own keys only, so a name like "constructor" cannot reach Object.prototype.
    if (!Object.hasOwn(handlers, method)) {
      throw new Error(`Unknown method ${method}`)
    }
    const fn = handlers[method] as (...a: unknown[]) => unknown
    return fn(...args)
  })
}
