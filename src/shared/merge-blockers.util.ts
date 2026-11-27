import type { MergeBlocker, MergeStatus } from './merge-status.types.ts'

/** Names listed in a label before "+N more". */
const NAMES_SHOWN = 2

function listNames(names: readonly string[]) {
  const shown = names.slice(0, NAMES_SHOWN).join(', ')
  if (names.length <= NAMES_SHOWN) {
    return shown
  }
  return `${shown} +${names.length - NAMES_SHOWN}`
}

/** "1 open thread", "3 open threads". */
function countThreads(count: number) {
  if (count === 1) {
    return '1 open thread'
  }
  return `${count} open threads`
}

/** Who asked for changes, for a chip: "changes asked by ana", or just "changes requested". */
function describeChangesAsked(names: readonly string[]) {
  if (names.length === 0) {
    return 'changes requested'
  }
  return `changes asked by ${listNames(names)}`
}

function describeChecks(checks: MergeStatus['checks']): MergeBlocker | null {
  if (checks === 'FAILURE' || checks === 'ERROR') {
    return { kind: 'checks-failing', label: 'checks failing', detail: 'A check on the latest commit failed.' }
  }
  if (checks === 'PENDING' || checks === 'EXPECTED') {
    return { kind: 'checks-running', label: 'checks running', detail: 'Checks on the latest commit have not finished.' }
  }
  return null
}

/** The reviewers still to answer, with you named "you" and first. */
function nameReviewers(reviewers: readonly string[], viewer: string | undefined) {
  if (!(viewer && reviewers.includes(viewer))) {
    return [...reviewers]
  }
  return ['you', ...reviewers.filter((reviewer) => reviewer !== viewer)]
}

function describeReviews(status: MergeStatus, viewer: string | undefined): MergeBlocker[] {
  const blockers: MergeBlocker[] = []
  if (status.reviewDecision === 'CHANGES_REQUESTED') {
    blockers.push({
      kind: 'changes-requested',
      label: describeChangesAsked(status.changesRequestedBy),
      detail: `Changes requested by ${status.changesRequestedBy.join(', ') || 'a reviewer'}.`,
    })
  }
  const pending = nameReviewers(status.pendingReviewers, viewer)
  if (pending.length > 0) {
    blockers.push({
      kind: 'awaiting-review',
      label: `waiting on ${listNames(pending)}`,
      detail: `Review requested and not given yet: ${pending.join(', ')}.`,
    })
  } else if (status.reviewDecision === 'REVIEW_REQUIRED') {
    blockers.push({ kind: 'awaiting-review', label: 'needs a review', detail: 'An approving review is required.' })
  }
  return blockers
}

/** What GitHub's overall verdict adds when nothing more specific explains it. */
function describeMergeState(status: MergeStatus, found: readonly MergeBlocker[]): MergeBlocker | null {
  if (status.mergeState === 'BEHIND') {
    return { kind: 'behind', label: 'behind its base', detail: 'The base branch moved on; it must be merged in first.' }
  }
  if (status.mergeState === 'BLOCKED' && found.length === 0) {
    return { kind: 'blocked', label: 'blocked by rules', detail: 'A branch protection rule blocks the merge.' }
  }
  return null
}

/**
 * What stands between a PR and merging, most pressing first: draft, conflicts, checks, reviews, open threads and
 * the base moving on. A single "ready to merge" when nothing does and GitHub agrees. `viewer` (your login) reads
 * as "you".
 */
export function describeBlockers(status: MergeStatus, viewer?: string): MergeBlocker[] {
  const blockers: MergeBlocker[] = []
  if (status.isDraft) {
    blockers.push({ kind: 'draft', label: 'draft', detail: 'Still a draft: not ready for review or merging.' })
  }
  if (status.mergeable === 'CONFLICTING') {
    blockers.push({ kind: 'conflicts', label: 'conflicts', detail: 'Conflicts with the base branch must be resolved.' })
  }
  const checks = describeChecks(status.checks)
  if (checks) {
    blockers.push(checks)
  }
  blockers.push(...describeReviews(status, viewer))
  if (status.unresolvedThreads !== null && status.unresolvedThreads > 0) {
    const threads = countThreads(status.unresolvedThreads)
    blockers.push({ kind: 'unresolved-threads', label: threads, detail: `${threads} not resolved yet.` })
  }
  const state = describeMergeState(status, blockers)
  if (state) {
    blockers.push(state)
  }
  if (blockers.length === 0 && status.mergeState === 'CLEAN') {
    return [{ kind: 'ready', label: 'ready to merge', detail: 'Approved, checks passing, nothing blocking.' }]
  }
  return blockers
}
