import { isSamePull, type PullRef } from '@shared/pull.types'
import type { MentionsInbox } from '@shared/mention.types'
import { InFlight } from '../common/in-flight.util'
import { markMentionRead } from './mention-match.util'
import { MENTION_WINDOW_DAYS } from './mentions.service'

export interface MentionWatcherDeps {
  load: () => Promise<MentionsInbox>
  markRead: (notificationId: string) => Promise<void>
  onMentions: (inbox: MentionsInbox) => void
}

/** Keeps the latest mentions; concurrent refreshes share one request. Errors keep the last good list. */
export class MentionWatcher {
  #latest: MentionsInbox | null = null
  readonly #inFlight = new InFlight<MentionsInbox>()
  readonly #deps: MentionWatcherDeps

  constructor(deps: MentionWatcherDeps) {
    this.#deps = deps
  }

  get latest() {
    return this.#latest
  }

  refresh(): Promise<MentionsInbox> {
    return this.#inFlight.run('mentions', () => this.#load())
  }

  /** Marks the PR's GitHub notification read and clears its "new" mentions. */
  async markRead(ref: PullRef) {
    const mention = this.#latest?.mentions.find((m) => isSamePull(m, ref))
    if (mention?.notificationId) await this.#deps.markRead(mention.notificationId)
    if (!this.#latest) return
    this.#publish({ ...this.#latest, mentions: markMentionRead(this.#latest.mentions, ref) })
  }

  async #load(): Promise<MentionsInbox> {
    try {
      this.#publish(await this.#deps.load())
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[revio] mentions failed:', error)
      this.#publish(this.#latest ? { ...this.#latest, error } : { viewer: '', mentions: [], windowDays: MENTION_WINDOW_DAYS, fetchedAt: new Date().toISOString(), error })
    }
    return this.#latest!
  }

  #publish(inbox: MentionsInbox) {
    this.#latest = inbox
    this.#deps.onMentions(inbox)
  }
}
