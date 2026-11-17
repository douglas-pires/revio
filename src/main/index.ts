import { app, BrowserWindow } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { showNotification } from './alerts/notification.service'
import { registerApi } from './app/api.controller'
import { AppWindow } from './app/app.window'
import { installAppMenu } from './app/app.menu'
import { loginShell } from './common/shell.util'
import { configureTokenResolver, gh } from './github/github.client'
import { GithubTokens } from './github/github-tokens.service'
import { HistoryCache } from './history/history.cache'
import { showUpdateResult } from './updates/update-dialog.service'
import { UpdatePoller } from './updates/update.poller'
import { releaseSourceOf } from './updates/release.util'
import { fetchLatestRelease } from './updates/updates.service'
import { InboxPoller } from './inbox/inbox.poller'
import { fetchInbox } from './inbox/inbox.service'
import { alertNewMentions } from './mentions/mention-alerts.service'
import { fetchMentions } from './mentions/mentions.service'
import { MentionWatcher } from './mentions/mentions.watcher'
import { PullCache } from './pulls/pull.cache'
import { fetchPull } from './pulls/pull.service'
import { StackFinder } from './stacks/stacks.service'
import { flush, store } from './store/store.service'
import { ThreadCache } from './threads/threads.cache'
import { fetchThreads } from './threads/threads.service'

// Composition root: creates the long-lived services once and hands them to whoever needs them.
const window = new AppWindow()
const tokens = new GithubTokens({
  readSaved: () => store.githubToken(),
  save: (token) => store.updateSettings({ githubToken: token }),
  dotEnvPath: app.isPackaged ? null : join(app.getAppPath(), '.env'),
  env: process.env,
  readCliToken: () => loginShell('gh auth token'),
})
configureTokenResolver(() => tokens.resolve())
const pulls = new PullCache(fetchPull)
const history = new HistoryCache(gh)
const releaseSource = releaseSourceOf(JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')))
const updates = new UpdatePoller({
  current: app.getVersion(),
  sourceName: releaseSource && `${releaseSource.owner}/${releaseSource.repo}`,
  loadLatest: async () => (releaseSource ? fetchLatestRelease(await gh(), releaseSource, process.arch) : null),
  onStatus: (status) => window.send({ type: 'update', status }),
})
const stackFinder = new StackFinder()
const threads = new ThreadCache(async () => fetchThreads(await gh()))
const mentions = new MentionWatcher({
  load: async () => fetchMentions(await gh()),
  markRead: async (notificationId) => {
    await (await gh()).request('PATCH /notifications/threads/{thread_id}', { thread_id: Number(notificationId) })
  },
  onMentions: (latest) => {
    window.send({ type: 'mentions', mentions: latest })
    alertNewMentions(latest, {
      state: () => store.alerts(),
      save: () => store.saveAlerts(),
      enabled: () => store.settings().notifyOnMention,
      show: showNotification,
      openPull: (ref) => window.focusAndOpen(ref),
      showApp: () => window.show(),
    })
  },
})
const poller = new InboxPoller({
  loadInbox: () => fetchInbox(stackFinder),
  onInbox: (inbox) => {
    window.send({ type: 'inbox', inbox })
    // Mentions refresh on the same schedule as the inbox.
    void mentions.refresh()
  },
  onOpenPull: (ref) => window.focusAndOpen(ref),
})

registerApi({ store, tokens, poller, pulls, history, updates, threads, mentions, window })

app.setName('Revio')

app.whenReady().then(() => {
  installAppMenu({
    navigate: (direction) => window.send({ type: 'navigate', direction }),
    checkForUpdates: () => void updates.check().then(showUpdateResult),
  })
  // Development runs from source, where a release would always look newer; check there only from the menu.
  if (app.isPackaged) updates.start()
  // Packaged builds take the icon from the bundle; in development the dock would show Electron's.
  if (!app.isPackaged) app.dock?.setIcon(join(app.getAppPath(), 'build/icon.png'))
  window.create()
  poller.start()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) window.create()
  })
})

// Stay alive in the dock on macOS so review alerts keep coming.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', flush)
