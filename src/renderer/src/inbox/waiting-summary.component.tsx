import type { PullSummary } from '@shared/inbox.types.ts'
import { useContext } from 'react'
import { formatDuration } from '../common/format.util.ts'
import { MergeStatusesContext } from '../common/merge-statuses.context.ts'
import { summarizeWaiting } from './waiting-on-you.util.ts'

/** "1 PR" or "3 PRs"; "1 person" or "2 people". */
function countOf(count: number, one: string, many: string) {
  if (count === 1) {
    return `${count} ${one}`
  }
  return `${count} ${many}`
}

/** Who is waiting on you: PRs and people, the longest wait, and how many only need your review to merge. */
export function WaitingSummary({ requested }: { requested: readonly PullSummary[] }) {
  const { statuses, viewer } = useContext(MergeStatusesContext)
  if (requested.length === 0 || viewer === undefined) {
    return null
  }
  const summary = summarizeWaiting(requested, statuses, viewer)
  return (
    <p className="flex flex-wrap items-center gap-x-2 px-1 pb-3 text-muted text-xs">
      <span>
        <span className="font-medium text-fg">{countOf(summary.pulls, 'PR', 'PRs')}</span> waiting on you, from{' '}
        {countOf(summary.people, 'person', 'people')}
      </span>
      {summary.longest && (
        <span>
          · longest: {summary.longest.author}, {formatDuration(summary.longest.hours)}
        </span>
      )}
      {summary.lastBlocker > 0 && (
        <span className="text-accent" title="Only your review is left before these can merge">
          · {summary.lastBlocker} only need you
        </span>
      )}
    </p>
  )
}
