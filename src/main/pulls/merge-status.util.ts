import type { MergeStatus } from '@shared/merge-status.types.ts'
import { isPresent } from '@shared/presence.util.ts'
import type { RawReviewer } from '../inbox/review-request.util.ts'
import { listReviewersByVerdict, type Verdict } from '../inbox/verdict.util.ts'

/**
 * The GraphQL fields a merge status is read from, beyond those the inbox already asks for. Light enough for the
 * inbox's search of many PRs; open threads cost too much there (GitHub answers 502), so only one PR's own query
 * adds `THREAD_FIELDS`.
 */
export const MERGE_STATUS_FIELDS = /* GraphQL */ `
  mergeable mergeStateStatus
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
`
export const THREAD_FIELDS = /* GraphQL */ 'reviewThreads(first: 100) { nodes { isResolved } }'

/** A PR's fields that a merge status is read from, as GraphQL returns them. */
export interface RawMergeFields {
  isDraft: boolean
  reviewDecision: string | null
  mergeable: MergeStatus['mergeable']
  mergeStateStatus: string
  commits: { nodes: ({ commit: { statusCheckRollup: { state: MergeStatus['checks'] } | null } } | null)[] }
  /** Only in one PR's own query. */
  reviewThreads?: { nodes: ({ isResolved: boolean } | null)[] }
  latestOpinionatedReviews: { nodes: (Verdict | null)[] } | null
  reviewRequests: { nodes: ({ requestedReviewer: RawReviewer } | null)[] }
}

/** A requested reviewer's name: a login, or "@team" (a team GitHub would not name, without read:org, is "a team"). */
function nameReviewer(reviewer: RawReviewer) {
  if (reviewer?.login) {
    return reviewer.login
  }
  if (reviewer?.slug) {
    return `@${reviewer.slug}`
  }
  return 'a team'
}

/** Open threads, or null when they were not asked for. */
function countUnresolved(threads: RawMergeFields['reviewThreads']) {
  if (!threads) {
    return null
  }
  return threads.nodes.filter((thread) => thread && !thread.isResolved).length
}

export function toMergeStatus(raw: RawMergeFields): MergeStatus {
  return {
    isDraft: raw.isDraft,
    mergeable: raw.mergeable,
    mergeState: raw.mergeStateStatus,
    checks: raw.commits.nodes.at(-1)?.commit.statusCheckRollup?.state ?? null,
    reviewDecision: raw.reviewDecision,
    changesRequestedBy: listReviewersByVerdict(raw.latestOpinionatedReviews?.nodes ?? [], 'CHANGES_REQUESTED'),
    pendingReviewers: raw.reviewRequests.nodes.filter(isPresent).map((node) => nameReviewer(node.requestedReviewer)),
    unresolvedThreads: countUnresolved(raw.reviewThreads),
  }
}
