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
  #win: BrowserWindow | null = null
  readonly #page: AppPage = {
    devUrl: env.ELECTRON_RENDERER_URL,
    indexFile: join(import.meta.dirname, '../renderer/index.html'),
  }

  /** Whether `url` is the app's own page, the only one allowed to call the IPC API. */
  isAppPage(url: string | undefined) {
    return isAppPage(url, this.#page)
  }

  /** Opens the window and returns it. */
  create(): BrowserWindow {
    const win = new BrowserWindow({
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
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => {
      this.#win = null
    })
    // Three-finger swipe (with "Swipe between pages" on in System Settings) goes back and forward.
    win.on('swipe', (_e, direction) => {
      if (direction === 'right') {
        this.send({ type: 'navigate', direction: 'back' })
      }
      if (direction === 'left') {
        this.send({ type: 'navigate', direction: 'forward' })
      }
    })
    win.webContents.setWindowOpenHandler(({ url }) => {
      openInBrowser(url)
      return { action: 'deny' }
    })
    // The window only ever shows the app. A link that would load another page here (one inside a Mermaid diagram,
    // say) opens in the browser instead, so no other page gets the preload's API.
    win.webContents.on('will-frame-navigate', (e) => {
      if (this.isAppPage(e.url)) {
        return
      }
      e.preventDefault()
      if (e.isMainFrame) {
        openInBrowser(e.url)
      }
    })
    if (this.#page.devUrl) {
      win.loadURL(this.#page.devUrl)
    } else {
      win.loadFile(this.#page.indexFile)
    }
    this.#win = win
    return win
  }

  send(event: MainEvent) {
    this.#win?.webContents.send(IPC.event, event)
  }

  show() {
    this.#win?.show()
  }

  /** Brings the window forward (creating it if needed) and opens a PR in it. */
  focusAndOpen(ref: PullRef) {
    const win = this.#win ?? this.create()
    if (win.isMinimized()) {
      win.restore()
    }
    win.show()
    win.focus()
    const event: MainEvent = { type: 'open-pull', ref: { repo: ref.repo, number: ref.number } }
    let delayMs = 0
    if (win.webContents.isLoading()) {
      delayMs = MOUNT_DELAY_MS
    }
    setTimeout(() => this.send(event), delayMs)
  }
}
