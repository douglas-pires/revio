import { DEFAULT_LOOKBACK_DAYS } from '@shared/lookback.util.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { InFlight } from '../common/in-flight.util.ts'

/** Half an hour: past reviews change only when you send one, which drops the copies. */
const MAX_AGE_MS = 1_800_000

/** Your past reviews over each span asked for, fetched at most every half hour; requests during a fetch share it. */
export class ReviewHistoryCache {
  private readonly latest = new Map<number, { at: number; reviews: PastReview[] }>()
  private readonly inFlight = new InFlight<PastReview[]>()
  private readonly fetch: (days: number) => Promise<PastReview[]>

  constructor(fetch: (days: number) => Promise<PastReview[]>) {
    this.fetch = fetch
  }

  /** The reviews you sent in the last `days`. */
  get(days = DEFAULT_LOOKBACK_DAYS): Promise<PastReview[]> {
    const cached = this.latest.get(days)
    if (cached && Date.now() - cached.at <= MAX_AGE_MS) {
      return Promise.resolve(cached.reviews)
    }
    return this.inFlight.run(String(days), async () => {
      const reviews = await this.fetch(days)
      this.latest.set(days, { at: Date.now(), reviews })
      return reviews
    })
  }

  /** Drops every copy, e.g. after you send a review. */
  forget(): void {
    this.latest.clear()
  }
}
