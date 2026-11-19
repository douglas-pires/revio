import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { showNotification } from './alerts/notification.service.ts'
import { registerApi } from './app/api.controller.ts'
import { installAppMenu } from './app/app.menu.ts'
import { AppWindow } from './app/app.window.ts'
import { env } from './common/env.config.ts'
import { runWithInput } from './common/shell.util.ts'
import { EditorService } from './editor/editor.service.ts'
import { configureTokenResolver, gh } from './github/github.client.ts'
import { GithubTokens } from './github/github-tokens.service.ts'
import { HistoryCache } from './history/history.cache.ts'
import { InboxPoller } from './inbox/inbox.poller.ts'
import { fetchInbox } from './inbox/inbox.service.ts'
import { alertNewMentions } from './mentions/mention-alerts.service.ts'
import { fetchMentions } from './mentions/mentions.service.ts'
import { MentionWatcher } from './mentions/mentions.watcher.ts'
import { PullCache } from './pulls/pull.cache.ts'
import { fetchPull } from './pulls/pull.service.ts'
import { StackFinder } from './stacks/stacks.service.ts'
import { flush, store } from './store/store.service.ts'
import { ThreadCache } from './threads/threads.cache.ts'
import { fetchThreads } from './threads/threads.service.ts'
import { releaseSourceOf } from './updates/release.util.ts'
import { UpdatePoller } from './updates/update.poller.ts'
import { showUpdateResult } from './updates/update-dialog.service.ts'
import { fetchLatestRelease } from './updates/updates.service.ts'

/** The project's .env when running from source; packaged builds read no .env. */
function dotEnvPathOf() {
  if (app.isPackaged) {
    return null
  }
  return join(app.getAppPath(), '.env')
}

// Composition root: creates the long-lived services once and hands them to whoever needs them.
const CLI_TOKEN_TIMEOUT_MS = 15_000
const window = new AppWindow()
const tokens = new GithubTokens({
  readSaved: () => store.githubToken(),
  save: (token) => store.updateSettings({ githubToken: token }),
  dotEnvPath: dotEnvPathOf(),
  env,
  // `gh` straight from the login-shell PATH (looked up once), not a login shell per call.
  readCliToken: async () =>
    (await runWithInput('gh', ['auth', 'token'], '', { timeoutMs: CLI_TOKEN_TIMEOUT_MS })).trim(),
})
configureTokenResolver(() => tokens.resolve())
const pulls = new PullCache(fetchPull)
const history = new HistoryCache(gh)
const releaseSource = releaseSourceOf(JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')))
const updates = new UpdatePoller({
  current: app.getVersion(),
  sourceName: releaseSource && `${releaseSource.owner}/${releaseSource.repo}`,
  loadLatest: async () => {
    if (!releaseSource) {
      return null
    }
    return fetchLatestRelease(await gh(), releaseSource, process.arch)
  },
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
    mentions.refresh()
  },
  onOpenPull: (ref) => window.focusAndOpen(ref),
})

const editor = new EditorService(() => store.settings())
registerApi({ store, tokens, poller, pulls, history, updates, threads, mentions, editor, window })

app.setName('Revio')

app.whenReady().then(() => {
  installAppMenu({
    navigate: (direction) => window.send({ type: 'navigate', direction }),
    checkForUpdates: async () => showUpdateResult(await updates.check()),
  })
  // Development runs from source, where a release would always look newer; check there only from the menu.
  if (app.isPackaged) {
    updates.start()
  }
  // Packaged builds take the icon from the bundle; in development the dock would show Electron's.
  if (!app.isPackaged) {
    app.dock?.setIcon(join(app.getAppPath(), 'build/icon.png'))
  }
  window.create()
  poller.start()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      window.create()
    }
  })
})

// Stay alive in the dock on macOS so review alerts keep coming.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', flush)
