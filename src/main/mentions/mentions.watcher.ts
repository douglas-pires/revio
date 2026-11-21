import { errorMessage } from '@shared/error.util.ts'
import type { MentionsInbox } from '@shared/mention.types.ts'
import { isSamePull, type PullRef } from '@shared/pull.types.ts'
import { InFlight } from '../common/in-flight.util.ts'
import { markMentionRead } from './mention-match.util.ts'
import { MENTION_WINDOW_DAYS } from './mentions.service.ts'

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
    const mention = this.#latest?.mentions.find((candidate) => isSamePull(candidate, ref))
    if (mention?.notificationId) {
      await this.#deps.markRead(mention.notificationId)
    }
    if (!this.#latest) {
      return
    }
    this.#publish({ ...this.#latest, mentions: markMentionRead(this.#latest.mentions, ref) })
  }

  async #load(): Promise<MentionsInbox> {
    let inbox: MentionsInbox
    try {
      inbox = await this.#deps.load()
    } catch (err) {
      const error = errorMessage(err)
      console.error('[revio] mentions failed:', error)
      inbox = this.#withError(error)
    }
    this.#publish(inbox)
    return inbox
  }

  /** The last mentions with the error, or an empty list carrying it. */
  #withError(error: string): MentionsInbox {
    if (this.#latest) {
      return { ...this.#latest, error }
    }
    return { viewer: '', mentions: [], windowDays: MENTION_WINDOW_DAYS, fetchedAt: new Date().toISOString(), error }
  }

  #publish(inbox: MentionsInbox) {
    this.#latest = inbox
    this.#deps.onMentions(inbox)
  }
}
