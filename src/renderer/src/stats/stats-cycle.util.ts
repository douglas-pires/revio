import type { StatsData, StatsPull } from '@shared/stats.types.ts'
import { isBot, isCounted } from './stats-people.util.ts'
import { measureGap, median } from './stats-time.util.ts'

/** A merged PR's time from first commit to merge, in its four stretches. */
export interface CycleTime {
  pull: StatsPull
  /** First commit to opened for review. */
  codingMs: number
  /** Opened for review to the first review. */
  waitingMs: number
  /** First review to the last approval. */
  reviewingMs: number
  /** Last approval to merge. */
  mergingMs: number
  totalMs: number
}

/** Reviews by others than the author and apps, oldest first. */
function readOthersReviews(pull: StatsPull) {
  return pull.reviews
    .filter((review) => review.reviewer !== pull.author && !isBot(review.reviewer) && review.state !== 'PENDING')
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
}

/** The first review by someone else once the PR was opened for review; null for none. */
function readFirstReviewAt(pull: StatsPull) {
  const reviews = readOthersReviews(pull)
  return (reviews.find((review) => review.submittedAt >= pull.readyAt) ?? reviews[0])?.submittedAt ?? null
}

/** A merged PR's cycle time, in stretches that add up to it. */
function measureCycleTime(pull: StatsPull, mergedAt: string): CycleTime {
  const startedAt = [pull.firstCommitAt ?? pull.createdAt, pull.readyAt].sort()[0]!
  const firstReviewAt = readFirstReviewAt(pull)
  const approvedAt =
    readOthersReviews(pull)
      .filter((review) => review.state === 'APPROVED' && review.submittedAt <= mergedAt)
      .at(-1)?.submittedAt ?? null
  const codingMs = measureGap(startedAt, pull.readyAt)
  const waitingMs = measureGap(pull.readyAt, firstReviewAt ?? mergedAt)
  const reviewingMs = firstReviewAt === null ? 0 : measureGap(firstReviewAt, approvedAt ?? mergedAt)
  const mergingMs = approvedAt === null ? 0 : measureGap(approvedAt, mergedAt)
  return { pull, codingMs, waitingMs, reviewingMs, mergingMs, totalMs: codingMs + waitingMs + reviewingMs + mergingMs }
}

/** The cycle time of each PR the scope's people merged since `since`. */
export function measureCycleTimes(data: StatsData, since: number): CycleTime[] {
  return data.pulls.flatMap((pull) => {
    if (pull.mergedAt === null || Date.parse(pull.mergedAt) < since || !isCounted(data, pull.author)) {
      return []
    }
    return [measureCycleTime(pull, pull.mergedAt)]
  })
}

/** The median of each stretch, for the cycle-time bar. */
export function summarizeCycleTimes(cycles: CycleTime[]) {
  const medianOf = (pick: (cycle: CycleTime) => number) => median(cycles.map(pick)) ?? 0
  return {
    codingMs: medianOf((cycle) => cycle.codingMs),
    waitingMs: medianOf((cycle) => cycle.waitingMs),
    reviewingMs: medianOf((cycle) => cycle.reviewingMs),
    mergingMs: medianOf((cycle) => cycle.mergingMs),
    totalMs: median(cycles.map((cycle) => cycle.totalMs)),
  }
}

/** PR sizes by lines changed, smallest first. */
const SIZE_BUCKETS = [
  { label: 'XS', maxLines: 10 },
  { label: 'S', maxLines: 100 },
  { label: 'M', maxLines: 400 },
  { label: 'L', maxLines: 1000 },
  { label: 'XL', maxLines: Number.POSITIVE_INFINITY },
] as const

/** For each size, how many PRs the scope's people opened since `since`, and how long they waited and took. */
export function groupBySize(data: StatsData, since: number, cycles: CycleTime[]) {
  const opened = data.pulls.filter((pull) => Date.parse(pull.createdAt) >= since && isCounted(data, pull.author))
  let floor = 0
  return SIZE_BUCKETS.map((bucket) => {
    const inBucket = opened.filter((pull) => {
      const lines = pull.additions + pull.deletions
      return lines >= floor && lines < bucket.maxLines
    })
    floor = bucket.maxLines
    const waits = inBucket.flatMap((pull) => {
      const firstReviewAt = readFirstReviewAt(pull)
      return firstReviewAt === null ? [] : [measureGap(pull.readyAt, firstReviewAt)]
    })
    const urls = new Set(inBucket.map((pull) => pull.url))
    return {
      label: bucket.label,
      pulls: inBucket.length,
      medianWaitMs: median(waits),
      medianCycleMs: median(cycles.filter((cycle) => urls.has(cycle.pull.url)).map((cycle) => cycle.totalMs)),
    }
  })
}
