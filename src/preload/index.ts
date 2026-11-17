import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type RevioApi } from '../shared/api.contract'
import type { MainEvent } from '../shared/event.types'

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
  'getSettings', 'updateSettings', 'githubAuthStatus', 'saveGithubToken', 'getInbox', 'getMentions', 'refreshMentions', 'markMentionRead', 'getThreads', 'replyToThread', 'setThreadResolved', 'refreshInbox', 'getPull', 'getStack', 'getLocalState', 'saveDrafts',
  'setViewed', 'submitReview', 'replyToComment', 'setReaction', 'getBlame', 'getFileHistory', 'getCommitFilePatch', 'listGuidelines', 'saveGuideline', 'deleteGuideline',
  'resolveGuidelines', 'knownRepos', 'generateBriefing', 'askClaude', 'saveAsks', 'openExternal', 'onEvent',
] as const satisfies readonly (keyof RevioApi)[]

contextBridge.exposeInMainWorld('revio', Object.fromEntries(methods.map((m) => [m, api[m]])))
