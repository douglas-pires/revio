import type { MergeStatus } from '@shared/merge-status.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { useEffect, useState } from 'react'
import { MergeChips } from '../common/merge-chips.component.tsx'

/** What stands between the PR and merging, fresh from GitHub each time the PR is fetched again. */
function useMergeStatus(pull: PullRef, fetchedAt: string) {
  const [status, setStatus] = useState<MergeStatus | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a fresh fetch of the PR (new fetchedAt) is the trigger to ask GitHub again.
  useEffect(() => {
    let live = true
    globalThis.revio
      .getMergeStatus(pull)
      .then((loaded) => live && setStatus(loaded))
      // Without it the bar simply does not show.
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [pull, fetchedAt])
  return status
}

/** A slim bar under the PR's header: what blocks the merge (conflicts, checks, reviews, open threads), or ready. */
export function MergeBar({ pull, fetchedAt, viewer }: { pull: PullRef; fetchedAt: string; viewer: string }) {
  const status = useMergeStatus(pull, fetchedAt)
  if (!status) {
    return null
  }
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line px-4 py-1.5 text-[12px]">
      <span className="mr-1 text-muted">Merge</span>
      <MergeChips status={status} viewer={viewer} />
    </div>
  )
}
