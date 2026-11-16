import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/api.contract'
import type { MainEvent, PullRef } from '@shared/types'

/** Delay before routing in a window that is still loading, so the renderer has mounted. */
const MOUNT_DELAY_MS = 1200

/** The single app window: created on demand, receives main → renderer events. */
export class AppWindow {
  #win: BrowserWindow | null = null

  create() {
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
      webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), contextIsolation: true, sandbox: true },
    })
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => (this.#win = null))
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
    else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
    this.#win = win
  }

  send(event: MainEvent) {
    this.#win?.webContents.send(IPC.event, event)
  }

  show() {
    this.#win?.show()
  }

  /** Brings the window forward (creating it if needed) and opens a PR in it. */
  focusAndOpen(ref: PullRef) {
    if (!this.#win) this.create()
    const win = this.#win!
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    const event: MainEvent = { type: 'open-pull', ref: { repo: ref.repo, number: ref.number } }
    setTimeout(() => this.send(event), win.webContents.isLoading() ? MOUNT_DELAY_MS : 0)
  }
}
