import { describeBlockers } from '@shared/merge-blockers.util.ts'
import type { MergeBlocker, MergeStatus } from '@shared/merge-status.types.ts'
import { joinClassNames } from './format.util.ts'

/** How each blocker looks: red for what needs fixing, amber for what is waiting, green when ready. */
const TONES: Record<MergeBlocker['kind'], string> = {
  conflicts: 'bg-danger/15 text-danger',
  'checks-failing': 'bg-danger/15 text-danger',
  'changes-requested': 'bg-danger/15 text-danger',
  'checks-running': 'bg-warn/15 text-warn',
  'awaiting-review': 'bg-warn/15 text-warn',
  behind: 'bg-warn/15 text-warn',
  blocked: 'bg-warn/15 text-warn',
  'unresolved-threads': 'bg-accent/15 text-accent',
  draft: 'bg-panel-2 text-muted',
  ready: 'bg-ok/15 text-ok',
}

/** Chips a row already shows in its own way (the draft and verdict chips), left out of its compact list. */
const SHOWN_ELSEWHERE: ReadonlySet<MergeBlocker['kind']> = new Set(['draft', 'changes-requested'])
/** Chips in a compact list before "+N". */
const COMPACT_LIMIT = 2

function Chip({ blocker }: { blocker: MergeBlocker }) {
  return (
    <span className={joinClassNames('chip shrink-0 whitespace-nowrap', TONES[blocker.kind])} title={blocker.detail}>
      {blocker.kind === 'ready' && '✓ '}
      {blocker.label}
    </span>
  )
}

/** The blockers past the first few, as a "+N" chip naming them all in its tooltip; nothing when none. */
function MoreChip({ rest }: { rest: readonly MergeBlocker[] }) {
  if (rest.length === 0) {
    return null
  }
  return (
    <span className="chip shrink-0 bg-panel-2 text-muted" title={rest.map((blocker) => blocker.label).join('\n')}>
      +{rest.length}
    </span>
  )
}

/**
 * What stands between a PR and merging, as chips. Compact (a row) shows the first two and "+N", leaving out what the
 * row shows already; full (the PR's bar) shows them all.
 */
export function MergeChips({
  status,
  viewer,
  compact = false,
}: {
  status: MergeStatus
  /** Your login, named "you". */
  viewer?: string | undefined
  compact?: boolean
}) {
  let blockers = describeBlockers(status, viewer)
  let limit = blockers.length
  if (compact) {
    blockers = blockers.filter((blocker) => !SHOWN_ELSEWHERE.has(blocker.kind))
    limit = COMPACT_LIMIT
  }
  return (
    <>
      {blockers.slice(0, limit).map((blocker) => (
        <Chip key={blocker.kind} blocker={blocker} />
      ))}
      <MoreChip rest={blockers.slice(limit)} />
    </>
  )
}
