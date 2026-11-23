import { readErrorMessage } from '@shared/error.util.ts'
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
  private latestMentions: MentionsInbox | null = null
  private readonly inFlight = new InFlight<MentionsInbox>()
  private readonly deps: MentionWatcherDeps

  constructor(deps: MentionWatcherDeps) {
    this.deps = deps
  }

  get latest() {
    return this.latestMentions
  }

  refresh(): Promise<MentionsInbox> {
    return this.inFlight.run('mentions', () => this.load())
  }

  /** Marks the PR's GitHub notification read and clears its "new" mentions. */
  async markRead(ref: PullRef) {
    const mention = this.latestMentions?.mentions.find((candidate) => isSamePull(candidate, ref))
    if (mention?.notificationId) {
      await this.deps.markRead(mention.notificationId)
    }
    if (!this.latestMentions) {
      return
    }
    this.publish({ ...this.latestMentions, mentions: markMentionRead(this.latestMentions.mentions, ref) })
  }

  private async load(): Promise<MentionsInbox> {
    let inbox: MentionsInbox
    try {
      inbox = await this.deps.load()
    } catch (failure) {
      const error = readErrorMessage(failure)
      console.error('[revio] mentions failed:', error)
      inbox = this.withError(error)
    }
    this.publish(inbox)
    return inbox
  }

  /** The last mentions with the error, or an empty list carrying it. */
  private withError(error: string): MentionsInbox {
    if (this.latestMentions) {
      return { ...this.latestMentions, error }
    }
    return { viewer: '', mentions: [], windowDays: MENTION_WINDOW_DAYS, fetchedAt: new Date().toISOString(), error }
  }

  private publish(inbox: MentionsInbox) {
    this.latestMentions = inbox
    this.deps.onMentions(inbox)
  }
}
