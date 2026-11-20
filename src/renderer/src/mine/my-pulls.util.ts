import type { PullSummary } from '@shared/inbox.types.ts'

type GroupName = 'changesRequested' | 'approved' | 'inReview' | 'drafts'

function groupOf(pr: PullSummary): GroupName {
  if (pr.isDraft) {
    return 'drafts'
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return 'changesRequested'
  }
  if (pr.reviewDecision === 'APPROVED') {
    return 'approved'
  }
  return 'inReview'
}

/** Your open PRs by what they need next. Each list keeps the order it came in (most recently updated first). */
export interface MyPullGroups {
  /** A reviewer asked for changes: your move. */
  changesRequested: PullSummary[]
  /** Approved and ready to merge. */
  approved: PullSummary[]
  /** Out for review, waiting on reviewers. */
  inReview: PullSummary[]
  /** Not ready for review yet. */
  drafts: PullSummary[]
}

export function groupMyPulls(prs: readonly PullSummary[]): MyPullGroups {
  const groups: MyPullGroups = { changesRequested: [], approved: [], inReview: [], drafts: [] }
  for (const pr of prs) {
    groups[groupOf(pr)].push(pr)
  }
  return groups
}

/** How many of your PRs need you to act: the ones with changes requested. */
export function myPullsNeedingYou(prs: readonly PullSummary[]): number {
  return prs.filter((pr) => groupOf(pr) === 'changesRequested').length
}
