import type { StatsData } from '@shared/stats.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'
import { groupBySize, measureCycleTimes, summarizeCycleTimes } from './stats-cycle.util.ts'
import { findReviewWaits, listReviewsSent, summarizeReviewers } from './stats-reviews.util.ts'
import { median, percentile } from './stats-time.util.ts'
import { groupByWeek } from './stats-weeks.util.ts'

/** The share of waits that counts as "the slowest": the slowest tenth. */
const SLOW_SHARE = 0.9

/** Everything the Stats screen shows, from the fetched PRs. */
export function computeStats(data: StatsData, now: number) {
  const since = now - data.days * MS_PER_DAY
  const waits = findReviewWaits(data, since)
  const cycles = measureCycleTimes(data, since)
  const answered = waits.flatMap((wait) => (wait.waitMs === null ? [] : [wait.waitMs]))
  return {
    waits: {
      medianMs: median(answered),
      slowMs: percentile(answered, SLOW_SHARE),
      answered: answered.length,
      stillWaiting: waits.filter((wait) => wait.waitMs === null && wait.pull.closedAt === null).length,
    },
    cycle: summarizeCycleTimes(cycles),
    merged: cycles.length,
    reviewsSent: listReviewsSent(data, since).length,
    reviewers: summarizeReviewers(data, since, waits),
    sizes: groupBySize(data, since, cycles),
    weeks: groupByWeek(data, { since, now }, cycles, waits),
  }
}

export type ComputedStats = ReturnType<typeof computeStats>
