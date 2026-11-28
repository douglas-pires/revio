import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type RevioApi } from '../shared/api.contract.ts'
import type { MainEvent } from '../shared/event.types.ts'

const invoke =
  (method: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(IPC.invoke, method, args)

const api = new Proxy({} as RevioApi, {
  get(_t, prop: string) {
    if (prop === 'onEvent') {
      return (listener: (event: MainEvent) => void) => {
        const wrapHandler = (_: unknown, event: MainEvent) => listener(event)
        ipcRenderer.on(IPC.event, wrapHandler)
        return () => ipcRenderer.removeListener(IPC.event, wrapHandler)
      }
    }
    return invoke(prop)
  },
})

// contextBridge cannot clone a Proxy, so expose a plain object built from the method list.
const methods = [
  'getSettings',
  'updateSettings',
  'githubAuthStatus',
  'saveGithubToken',
  'getSyncStatus',
  'syncNow',
  'getInbox',
  'getMentions',
  'refreshMentions',
  'markMentionRead',
  'getThreads',
  'replyToThread',
  'setThreadResolved',
  'refreshInbox',
  'getPull',
  'getChangesSinceReview',
  'getMergeStatus',
  'getMergeStatuses',
  'getStack',
  'getStackComments',
  'getLocalState',
  'saveDrafts',
  'setViewed',
  'submitReview',
  'replyToComment',
  'setReaction',
  'uploadImage',
  'commentOnPull',
  'getBlame',
  'getFileHistory',
  'getCommitFilePatch',
  'getCommitFiles',
  'getPullCommits',
  'getFileContent',
  'findSymbol',
  'listEditors',
  'openInEditor',
  'listGuidelines',
  'saveGuideline',
  'deleteGuideline',
  'resolveGuidelines',
  'knownRepos',
  'addGuideEntry',
  'findSimilarComments',
  'generateBriefing',
  'askClaude',
  'saveAsks',
  'saveDismissedConcerns',
  'explainFile',
  'listUnfamiliarFiles',
  'getUpdateStatus',
  'checkForUpdates',
  'downloadUpdate',
  'restartToUpdate',
  'testNotification',
  'getUnseenUpdate',
  'markUpdateSeen',
  'listReleaseNotes',
  'listEmojis',
  'listMentionables',
  'getPullLog',
  'getCommitDetail',
  'getCommitCi',
  'getCommitChecks',
  'getSystemInfo',
  'getFeedbackRepo',
  'submitFeedback',
  'openExternal',
  'onEvent',
] as const satisfies readonly (keyof RevioApi)[]

contextBridge.exposeInMainWorld('revio', Object.fromEntries(methods.map((method) => [method, api[method]])))
