import { app } from 'electron'
import type { Inbox, PullSummary } from '@shared/inbox.types'
import type { PullRef } from '@shared/pull.types'
import { raiseAlerts } from '../alerts/alerts.util'
import { InFlight } from '../common/in-flight.util'
import { showNotification } from '../alerts/notification.service'
import { store } from '../store/store.service'

export interface PollerDeps {
  loadInbox: () => Promise<Inbox>
  onInbox: (inbox: Inbox) => void
  onOpenPull: (ref: PullRef) => void
}

/** Polls GitHub on the configured interval, keeps the latest inbox, and raises review alerts. */
export class InboxPoller {
  #latest: Inbox | null = null
  #timer: NodeJS.Timeout | null = null
  readonly #inFlight = new InFlight<Inbox>()
  readonly #deps: PollerDeps

  constructor(deps: PollerDeps) {
    this.#deps = deps
  }

  get latest() {
    return this.#latest
  }

  start() {
    this.#schedule(0)
  }

  /** Re-arms the timer after the interval setting changes. */
  reschedule() {
    this.#schedule(intervalMs())
  }

  /** Fetches now; concurrent callers share one request. */
  poll(): Promise<Inbox> {
    return this.#inFlight.run('inbox', () => this.#fetch())
  }

  #schedule(delay: number) {
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = setTimeout(async () => {
      await this.poll().catch(() => {})
      this.#schedule(intervalMs())
    }, delay)
  }

  async #fetch(): Promise<Inbox> {
    let inbox: Inbox
    try {
      inbox = await this.#deps.loadInbox()
      raiseAlerts(inbox, { settings: store.settings(), state: store.alerts(), notify: (title, body, pr) => this.#notify(title, body, pr) })
      store.saveAlerts()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[revio] poll failed:', message)
      inbox = this.#latest ? { ...this.#latest, error: message } : emptyInbox(message)
    }
    this.#latest = inbox
    this.#deps.onInbox(inbox)
    if (process.platform === 'darwin') app.setBadgeCount(inbox.requested.length)
    return inbox
  }

  #notify(title: string, body: string, pr: PullSummary) {
    showNotification(title, body, () => this.#deps.onOpenPull(pr))
  }
}

const intervalMs = () => Math.max(1, store.settings().pollIntervalMinutes) * 60_000

const emptyInbox = (error: string): Inbox => ({ viewer: '', requested: [], reviewed: [], stacks: [], fetchedAt: new Date().toISOString(), error })
