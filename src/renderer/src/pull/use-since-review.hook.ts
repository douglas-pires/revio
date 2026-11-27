import type { PullDetail, PullRef, SinceReview } from '@shared/pull.types.ts'
import { useEffect, useMemo, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { groupByDir } from './files.util.ts'

/** Whether there is anything to compare: you reviewed the PR and it has moved on since. */
const hasMovedOn = (pr: PullDetail | null) => Boolean(pr?.lastReviewedSha && pr.lastReviewedSha !== pr.headSha)

/**
 * The changes since your last review: loaded when you reviewed the PR before and it moved on since, shown in place
 * of the full diff while `on`.
 */
export function useSinceReview(pull: PullRef, pr: PullDetail | null) {
  const [on, setOn] = useState(false)
  const [since, setSince] = useState<SinceReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const available = hasMovedOn(pr)
  const headSha = pr?.headSha
  useEffect(() => {
    if (!(available && headSha)) {
      setSince(null)
      return
    }
    let current = true
    setError(null)
    globalThis.revio
      .getChangesSinceReview(pull)
      .then((loaded) => current && setSince(loaded))
      .catch((failure: unknown) => current && setError(readErrorMessage(failure)))
    return () => {
      current = false
    }
  }, [pull, available, headSha])
  const files = useMemo(() => groupByDir(since?.files ?? []).flatMap(([, grouped]) => grouped), [since])
  return {
    available,
    on: on && available,
    toggle: () => setOn(!on),
    since,
    error,
    /** The files changed since, in the sidebar's folder order. */
    files,
  }
}

export type SinceReviewState = ReturnType<typeof useSinceReview>
