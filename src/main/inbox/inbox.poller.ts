import { errorMessage } from '@shared/error.util.ts'
import type { Inbox, PullSummary } from '@shared/inbox.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { MS_PER_MINUTE } from '@shared/time.util.ts'
import { app } from 'electron'
import { raiseAlerts } from '../alerts/alerts.util.ts'
import { showNotification } from '../alerts/notification.service.ts'
import { InFlight } from '../common/in-flight.util.ts'
import { store } from '../store/store.service.ts'

const intervalMs = () => Math.max(1, store.settings().pollIntervalMinutes) * MS_PER_MINUTE

/** After a failed poll: the last good inbox with the error, or an empty one carrying it. */
function keepLatest(latest: Inbox | null, error: string): Inbox {
  if (latest) {
    return { ...latest, error }
  }
  return emptyInbox(error)
}

const emptyInbox = (error: string): Inbox => ({
  viewer: '',
  requested: [],
  reviewed: [],
  mine: [],
  stacks: [],
  fetchedAt: new Date().toISOString(),
  error,
})

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
    if (this.#timer) {
      clearTimeout(this.#timer)
    }
    this.#timer = setTimeout(async () => {
      await this.poll().catch(() => {
        // #fetch already turned the failure into an inbox with an error; nothing else to do.
      })
      this.#schedule(intervalMs())
    }, delay)
  }

  async #fetch(): Promise<Inbox> {
    let inbox: Inbox
    try {
      inbox = await this.#deps.loadInbox()
      raiseAlerts(inbox, {
        settings: store.settings(),
        state: store.alerts(),
        notify: (title, body, pr) => this.#notify(title, body, pr),
      })
      store.saveAlerts()
    } catch (err) {
      const message = errorMessage(err)
      console.error('[revio] poll failed:', message)
      inbox = keepLatest(this.#latest, message)
    }
    this.#latest = inbox
    this.#deps.onInbox(inbox)
    if (process.platform === 'darwin') {
      app.setBadgeCount(inbox.requested.length)
    }
    return inbox
  }

  #notify(title: string, body: string, pr: PullSummary) {
    showNotification(title, body, () => this.#deps.onOpenPull(pr))
  }
}
