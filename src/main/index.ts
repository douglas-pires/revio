import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { IPC, type ApiMethod, type RevioApi } from '@shared/api'
import { pullKey, type MainEvent, type MentionsInbox } from '@shared/types'
import { ask } from './ask'
import { generateBriefing } from './claude'
import { fetchInbox, fetchPull, gh, replyToComment, resetClient, submitReview } from './github'
import { fetchThreads, replyToThread, setThreadResolved, ThreadFinder } from './threads'
import { githubAuthStatus, saveGithubToken } from './githubAuth'
import { deleteGuideline, resolveGuidelines, saveGuideline } from './guidelines'
import { InboxPoller } from './poller'
import { PullCache } from './pullCache'
import { fetchStack, StackFinder } from './stacks'
import { flush, store } from './store'
import { excerpt } from '@shared/excerpt'
import { takeNewMentions } from './alerts'
import { fetchMentions, MentionWatcher } from './mentions'
import { showNotification } from './notify'

let win: BrowserWindow | null = null
// Composition root: the long-lived services, created once and handed to whoever needs them.
const pulls = new PullCache(fetchPull)
const stackFinder = new StackFinder()
const threadFinder = new ThreadFinder(async () => fetchThreads(await gh()))
const mentionWatcher = new MentionWatcher({
  load: async () => fetchMentions(await gh()),
  markRead: async (notificationId) => {
    await (await gh()).request('PATCH /notifications/threads/{thread_id}', { thread_id: Number(notificationId) })
  },
  onMentions: (mentions) => {
    send({ type: 'mentions', mentions })
    alertNewMentions(mentions)
  },
})
const poller = new InboxPoller({
  loadInbox: () => fetchInbox(stackFinder),
  onInbox: (inbox) => {
    send({ type: 'inbox', inbox })
    // Mentions refresh on the same schedule as the inbox.
    void mentionWatcher.refresh()
  },
  onOpenPull: (repo, number) => focusAndOpen(repo, number),
})

function send(event: MainEvent) {
  win?.webContents.send(IPC.event, event)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Revio',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => (win = null))
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
}

/** A desktop notification per new mention (a summary past three), unless turned off in Settings. */
function alertNewMentions(mentions: MentionsInbox) {
  if (mentions.error) return
  const fresh = takeNewMentions(mentions, store.alerts())
  store.saveAlerts()
  if (!store.settings().notifyOnMention || !fresh.length) return
  for (const { mention, snippet } of fresh.slice(0, 3)) {
    const who = snippet.viaTeam ? `@${snippet.viaTeam}` : 'you'
    showNotification(`${snippet.author} mentioned ${who}`, `${mention.repo}#${mention.number} · ${mention.title}\n${excerpt(snippet.body, 140)}`, () =>
      focusAndOpen(mention.repo, mention.number),
    )
  }
  if (fresh.length > 3) showNotification(`${fresh.length - 3} more mentions`, 'Open Revio → Mentions to see them all.', () => win?.show())
}

function focusAndOpen(repo: string, number: number) {
  if (!win) createWindow()
  if (win?.isMinimized()) win.restore()
  win?.show()
  win?.focus()
  // Give a freshly created window a moment to mount before routing.
  setTimeout(() => send({ type: 'open-pull', repo, number }), win?.webContents.isLoading() ? 1200 : 0)
}

const handlers: { [K in ApiMethod]: (...args: Parameters<RevioApi[K]>) => ReturnType<RevioApi[K]> | Awaited<ReturnType<RevioApi[K]>> } = {
  getSettings: () => store.settings(),
  updateSettings: (patch) => {
    store.updateSettings(patch)
    if (patch.githubToken !== undefined) resetClient()
    if (patch.pollIntervalMinutes !== undefined) poller.reschedule()
    const affectsInbox = [patch.githubToken, patch.includeTeamRequests, patch.ignoreDrafts, patch.staleAfterHours].some((v) => v !== undefined)
    if (affectsInbox) void poller.poll()
    return store.settings()
  },
  githubAuthStatus: () => githubAuthStatus(),
  saveGithubToken: async (token) => {
    await saveGithubToken(token)
    resetClient()
    void poller.poll()
    return githubAuthStatus()
  },

  getInbox: () => poller.latest,
  getMentions: () => mentionWatcher.latest ?? mentionWatcher.refresh(),
  refreshMentions: () => mentionWatcher.refresh(),
  markMentionRead: (repo, number) => mentionWatcher.markRead(repo, number),
  getThreads: (maxAgeMs = 0) => threadFinder.get(maxAgeMs),
  replyToThread: async (threadId, body) => {
    const comment = await replyToThread(await gh(), threadId, body)
    threadFinder.forget()
    return comment
  },
  setThreadResolved: async (threadId, resolved) => {
    await setThreadResolved(await gh(), threadId, resolved)
    threadFinder.forget()
  },
  refreshInbox: () => poller.poll(),

  getPull: (repo, number, maxAgeMs = 0) => pulls.get(repo, number, maxAgeMs),
  getStack: (repo, number) => fetchStack(repo, number, poller.latest),
  getLocalState: (repo, number) => store.pull(pullKey(repo, number)),
  saveDrafts: (repo, number, drafts) => store.updatePull(pullKey(repo, number), (s) => void (s.drafts = drafts)),
  setViewed: (repo, number, path, sha) =>
    store.updatePull(pullKey(repo, number), (s) => {
      if (sha) s.viewed[path] = sha
      else delete s.viewed[path]
    }),
  submitReview: async (input) => {
    const key = pullKey(input.repo, input.number)
    const result = await submitReview(input, store.pull(key).drafts)
    store.updatePull(key, (s) => void (s.drafts = []))
    void poller.poll()
    return result
  },
  replyToComment: (repo, number, id, body) => replyToComment(repo, number, id, body),

  listGuidelines: () => store.guidelines(),
  saveGuideline: (g) => saveGuideline(g),
  deleteGuideline: (id) => deleteGuideline(id),
  resolveGuidelines: (repo, paths) => resolveGuidelines(repo, paths),
  knownRepos: () => {
    const inbox = poller.latest
    const repos = new Set<string>(store.guidelines().map((g) => g.repo).filter((r) => r !== '*'))
    for (const p of [...(inbox?.requested ?? []), ...(inbox?.reviewed ?? [])]) repos.add(p.repo)
    return [...repos].sort()
  },

  generateBriefing: async (repo, number) => {
    const key = pullKey(repo, number)
    const pr = pulls.peek(repo, number) ?? (await pulls.get(repo, number))
    const guidelines = resolveGuidelines(repo, pr.files.map((f) => f.path))
    const record = await generateBriefing(pr, guidelines, (message) => send({ type: 'briefing-progress', key, message }))
    store.updatePull(key, (s) => void (s.briefing = record))
    return record
  },

  askClaude: async (repo, number, thread) => {
    const key = pullKey(repo, number)
    const pr = pulls.peek(repo, number) ?? (await pulls.get(repo, number))
    const guidelines = resolveGuidelines(repo, pr.files.map((f) => f.path))
    const answer = await ask(pr, guidelines, store.pull(key).briefing, thread, (text) =>
      send({ type: 'ask-delta', threadId: thread.id, text }),
    )
    return { answer }
  },
  saveAsks: (repo, number, threads) => store.updatePull(pullKey(repo, number), (s) => void (s.asks = threads)),

  openExternal: async (url) => {
    if (/^https?:/.test(url)) await shell.openExternal(url)
  },
}

ipcMain.handle(IPC.invoke, async (_e, method: ApiMethod, args: unknown[]) => {
  const fn = handlers[method] as (...a: unknown[]) => unknown
  if (!fn) throw new Error(`Unknown method ${method}`)
  return fn(...args)
})

app.setName('Revio')

app.whenReady().then(() => {
  createWindow()
  poller.start()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Stay alive in the dock on macOS so review alerts keep coming.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', flush)
