import type { StatsData, StatsPull, StatsRequest } from '@shared/stats.types.ts'
import { isBot, isCounted, isScopeTeam } from './stats-people.util.ts'
import { measureGap, median } from './stats-time.util.ts'

/** A review asked for, and how long it waited for that review; `waitMs` null while it still waits. */
export interface ReviewWait {
  pull: StatsPull
  reviewer: string
  requestedAt: string
  reviewedAt: string | null
  waitMs: number | null
}

/** Who answers a request: the person asked, or for a team, any of its members (anyone, in a repository). */
function answersRequest(data: StatsData, pull: StatsPull, request: StatsRequest, reviewer: string) {
  if (reviewer === pull.author || isBot(reviewer)) {
    return false
  }
  if (request.reviewer.startsWith('@')) {
    return isCounted(data, reviewer)
  }
  return reviewer === request.reviewer
}

/** Whether a request is one these stats follow: to a counted person, to the scope's team, or any in a repository. */
function isFollowedRequest(data: StatsData, request: StatsRequest) {
  if (request.reviewer.startsWith('@')) {
    return data.scope.kind === 'repo' || isScopeTeam(data, request.reviewer)
  }
  return isCounted(data, request.reviewer)
}

/** The first request to each reviewer on a PR: asking again after a review is not a new wait. */
function readFirstRequests(pull: StatsPull) {
  const first = new Map<string, StatsRequest>()
  for (const request of [...pull.requests].sort((left, right) => left.at.localeCompare(right.at))) {
    if (!first.has(request.reviewer)) {
      first.set(request.reviewer, request)
    }
  }
  return [...first.values()]
}

/** Each review asked of the scope's people since `since`, and how long it took to come. */
export function findReviewWaits(data: StatsData, since: number): ReviewWait[] {
  return data.pulls.flatMap((pull) =>
    readFirstRequests(pull)
      .filter((request) => Date.parse(request.at) >= since && isFollowedRequest(data, request))
      .map((request) => {
        const answer = pull.reviews
          .filter((review) => review.submittedAt >= request.at)
          .filter((review) => answersRequest(data, pull, request, review.reviewer))
          .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))[0]
        const reviewedAt = answer?.submittedAt ?? null
        return {
          pull,
          reviewer: request.reviewer,
          requestedAt: request.at,
          reviewedAt,
          waitMs: reviewedAt === null ? null : measureGap(request.at, reviewedAt),
        }
      }),
  )
}

/** One reviewer's work in the period. */
export interface ReviewerSummary {
  reviewer: string
  reviews: number
  approvals: number
  changesRequested: number
  comments: number
  /** The median wait for the reviews asked of them; null when none were. */
  medianWaitMs: number | null
}

/** The reviews the scope's people sent on others' PRs since `since`, oldest first. */
export function listReviewsSent(data: StatsData, since: number) {
  return data.pulls
    .flatMap((pull) =>
      pull.reviews
        .filter((review) => review.reviewer !== pull.author && isCounted(data, review.reviewer))
        .filter((review) => review.state !== 'PENDING' && Date.parse(review.submittedAt) >= since)
        .map((review) => ({ pull, ...review })),
    )
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
}

/** Each reviewer's reviews since `since`, busiest first. */
export function summarizeReviewers(data: StatsData, since: number, waits: ReviewWait[]): ReviewerSummary[] {
  const byReviewer = new Map<string, ReviewerSummary>()
  for (const review of listReviewsSent(data, since)) {
    const summary = byReviewer.get(review.reviewer) ?? {
      reviewer: review.reviewer,
      reviews: 0,
      approvals: 0,
      changesRequested: 0,
      comments: 0,
      medianWaitMs: null,
    }
    summary.reviews += 1
    summary.approvals += Number(review.state === 'APPROVED')
    summary.changesRequested += Number(review.state === 'CHANGES_REQUESTED')
    summary.comments += review.comments
    byReviewer.set(review.reviewer, summary)
  }
  for (const summary of byReviewer.values()) {
    const answered = waits.filter((wait) => wait.reviewer === summary.reviewer && wait.waitMs !== null)
    summary.medianWaitMs = median(answered.map((wait) => wait.waitMs!))
  }
  return [...byReviewer.values()].sort((left, right) => right.reviews - left.reviews)
}
