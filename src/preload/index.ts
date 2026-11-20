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
      return (listener: (e: MainEvent) => void) => {
        const wrapped = (_: unknown, e: MainEvent) => listener(e)
        ipcRenderer.on(IPC.event, wrapped)
        return () => ipcRenderer.removeListener(IPC.event, wrapped)
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
  'getStack',
  'getLocalState',
  'saveDrafts',
  'setViewed',
  'submitReview',
  'replyToComment',
  'setReaction',
  'commentOnPull',
  'getBlame',
  'getFileHistory',
  'getCommitFilePatch',
  'getCommitFiles',
  'getPullCommits',
  'getFileContent',
  'listEditors',
  'openInEditor',
  'listGuidelines',
  'saveGuideline',
  'deleteGuideline',
  'resolveGuidelines',
  'knownRepos',
  'generateBriefing',
  'askClaude',
  'saveAsks',
  'getUpdateStatus',
  'checkForUpdates',
  'testNotification',
  'openExternal',
  'onEvent',
] as const satisfies readonly (keyof RevioApi)[]

contextBridge.exposeInMainWorld('revio', Object.fromEntries(methods.map((m) => [m, api[m]])))
