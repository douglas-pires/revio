import type { PullSummary } from '@shared/inbox.types.ts'
import { describeBlockers } from '@shared/merge-blockers.util.ts'
import type { MergeStatus } from '@shared/merge-status.types.ts'
import { buildPullKey } from '@shared/pull.types.ts'

/** Blockers that someone other than the reviewer has to clear first. */
const OTHERS_TO_CLEAR = new Set(['draft', 'conflicts', 'checks-failing', 'changes-requested'])

/**
 * Whether your review is the last thing holding a PR up: you (or the team you were asked through) are the only
 * reviewer left, and nothing else (conflicts, failing checks, changes requested, a draft) is in the way.
 */
export function isLastBlocker(status: MergeStatus, viewer: string, viaTeam: string | null) {
  const pending = status.pendingReviewers
  const onlyYou =
    pending.length > 0 && pending.every((name) => name === viewer || (viaTeam !== null && name === `@${viaTeam}`))
  return onlyYou && !describeBlockers(status, viewer).some((blocker) => OTHERS_TO_CLEAR.has(blocker.kind))
}

/** Who is waiting on you: how many PRs and people, who has waited longest, and how many only need you. */
export function summarizeWaiting(
  requested: readonly PullSummary[],
  statuses: Readonly<Record<string, MergeStatus>>,
  viewer: string,
) {
  const longest = requested.reduce<PullSummary | null>(
    (found, pull) => (found === null || pull.waitingHours > found.waitingHours ? pull : found),
    null,
  )
  const lastBlocker = requested.filter((pull) => {
    const status = statuses[buildPullKey(pull)]
    return status !== undefined && isLastBlocker(status, viewer, pull.viaTeam)
  }).length
  return {
    pulls: requested.length,
    people: new Set(requested.map((pull) => pull.author)).size,
    longest: longest && { author: longest.author, hours: longest.waitingHours },
    lastBlocker,
  }
}
