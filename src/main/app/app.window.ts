import { join } from 'node:path'
import { IPC } from '@shared/api.contract.ts'
import type { MainEvent } from '@shared/event.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { BrowserWindow, shell } from 'electron'
import { env } from '../common/env.config.ts'
import { isWebUrl } from '../common/web-url.util.ts'
import { type AppPage, isAppPage } from './app-page.util.ts'

/** Delay before routing in a window that is still loading, so the renderer has mounted. */
const MOUNT_DELAY_MS = 1200

function openInBrowser(url: string) {
  if (isWebUrl(url)) {
    shell.openExternal(url)
  }
}

/** The single app window: created on demand, receives main → renderer events. */
export class AppWindow {
  private win: BrowserWindow | null = null
  private readonly page: AppPage = {
    devUrl: env.ELECTRON_RENDERER_URL,
    indexFile: join(import.meta.dirname, '../renderer/index.html'),
  }

  /** Whether `url` is the app's own page, the only one allowed to call the IPC API. */
  isAppPage(url: string | undefined) {
    return isAppPage(url, this.page)
  }

  /** Opens the window and returns it. */
  create(): BrowserWindow {
    const browserWindow = new BrowserWindow({
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
    browserWindow.once('ready-to-show', () => browserWindow.show())
    browserWindow.on('closed', () => {
      this.win = null
    })
    // Three-finger swipe (with "Swipe between pages" on in System Settings) goes back and forward.
    browserWindow.on('swipe', (_e, direction) => {
      if (direction === 'right') {
        this.send({ type: 'navigate', direction: 'back' })
      }
      if (direction === 'left') {
        this.send({ type: 'navigate', direction: 'forward' })
      }
    })
    browserWindow.webContents.setWindowOpenHandler(({ url }) => {
      openInBrowser(url)
      return { action: 'deny' }
    })
    // The window only ever shows the app. A link that would load another page here (one inside a Mermaid diagram,
    // say) opens in the browser instead, so no other page gets the preload's API.
    browserWindow.webContents.on('will-frame-navigate', (event) => {
      if (this.isAppPage(event.url)) {
        return
      }
      event.preventDefault()
      if (event.isMainFrame) {
        openInBrowser(event.url)
      }
    })
    if (this.page.devUrl) {
      browserWindow.loadURL(this.page.devUrl)
    } else {
      browserWindow.loadFile(this.page.indexFile)
    }
    this.win = browserWindow
    return browserWindow
  }

  send(event: MainEvent) {
    this.win?.webContents.send(IPC.event, event)
  }

  show() {
    this.win?.show()
  }

  /** Brings the window forward (creating it if needed) and opens a PR in it. */
  focusAndOpen(ref: PullRef) {
    const browserWindow = this.win ?? this.create()
    if (browserWindow.isMinimized()) {
      browserWindow.restore()
    }
    browserWindow.show()
    browserWindow.focus()
    const event: MainEvent = { type: 'open-pull', ref: { repo: ref.repo, number: ref.number } }
    let delayMs = 0
    if (browserWindow.webContents.isLoading()) {
      delayMs = MOUNT_DELAY_MS
    }
    setTimeout(() => this.send(event), delayMs)
  }
}
