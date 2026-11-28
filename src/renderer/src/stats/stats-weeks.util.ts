import type { StatsData } from '@shared/stats.types.ts'
import type { CycleTime } from './stats-cycle.util.ts'
import { listReviewsSent, type ReviewWait } from './stats-reviews.util.ts'
import { listWeeks, median, readWeekStart } from './stats-time.util.ts'

/** One week of the period. */
export interface WeekStats {
  /** The Monday it starts, yyyy-mm-dd. */
  week: string
  merged: number
  medianCycleMs: number | null
  requestsIn: number
  reviewsOut: number
  medianWaitMs: number | null
}

/** The period week by week: PRs merged and their cycle time, reviews asked and sent, and how long reviews took. */
export function groupByWeek(
  data: StatsData,
  range: { since: number; now: number },
  cycles: CycleTime[],
  waits: ReviewWait[],
): WeekStats[] {
  const reviews = listReviewsSent(data, range.since)
  return listWeeks(range.since, range.now).map((week) => {
    const weekCycles = cycles.filter((cycle) => readWeekStart(cycle.pull.mergedAt!) === week)
    const weekWaits = waits.filter((wait) => readWeekStart(wait.requestedAt) === week)
    return {
      week,
      merged: weekCycles.length,
      medianCycleMs: median(weekCycles.map((cycle) => cycle.totalMs)),
      requestsIn: weekWaits.length,
      reviewsOut: reviews.filter((review) => readWeekStart(review.submittedAt) === week).length,
      medianWaitMs: median(weekWaits.flatMap((wait) => (wait.waitMs === null ? [] : [wait.waitMs]))),
    }
  })
}
