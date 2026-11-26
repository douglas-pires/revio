import type { PastReview } from '@shared/review-history.types.ts'
import { InFlight } from '../common/in-flight.util.ts'

/** Half an hour: past reviews change only when you send one, which drops the copy. */
const MAX_AGE_MS = 1_800_000

/** Your past reviews, fetched at most every half hour; requests while one fetch runs share it. */
export class ReviewHistoryCache {
  private latest: { at: number; reviews: PastReview[] } | null = null
  private readonly inFlight = new InFlight<PastReview[]>()
  private readonly fetch: () => Promise<PastReview[]>

  constructor(fetch: () => Promise<PastReview[]>) {
    this.fetch = fetch
  }

  get(): Promise<PastReview[]> {
    if (this.latest && Date.now() - this.latest.at <= MAX_AGE_MS) {
      return Promise.resolve(this.latest.reviews)
    }
    return this.inFlight.run('history', async () => {
      const reviews = await this.fetch()
      this.latest = { at: Date.now(), reviews }
      return reviews
    })
  }

  /** Drops the copy, e.g. after you send a review. */
  forget(): void {
    this.latest = null
  }
}
