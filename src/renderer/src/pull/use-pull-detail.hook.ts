import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResolvedGuideline } from '@shared/guideline.types'
import type { Stack } from '@shared/inbox.types'
import type { PullDetail, PullLocalState, PullRef } from '@shared/pull.types'
import { errorMessage } from '../common/format.util'
import { hasSameContent } from './pull-content.util'

/** A prefetched copy this recent is shown immediately. */
const PREFETCH_MAX_AGE_MS = 2 * 60_000
/** Copies older than this are refreshed in the background after showing. */
const FRESH_ENOUGH_MS = 15_000

/**
 * The PR, its local review state, the guides that apply and its stack. Shows a recent copy right away
 * when one exists (e.g. prefetched on hover), then refreshes it. `onLoaded` runs after every full load.
 */
export function usePullDetail(pull: PullRef, onLoaded: (pr: PullDetail, local: PullLocalState) => void) {
  const [pr, setPr] = useState<PullDetail | null>(null)
  const [guides, setGuides] = useState<ResolvedGuideline[]>([])
  const [error, setError] = useState<string | null>(null)
  const [stack, setStack] = useState<Stack | null>(null)
  const loaded = useRef(onLoaded)
  loaded.current = onLoaded
  /** A refetch that changed nothing keeps the current object, so memoized views stay put. */
  const showPr = useCallback((next: PullDetail) => setPr((prev) => (hasSameContent(prev, next) ? prev : next)), [])

  const load = useCallback(
    async (maxAgeMs = 0) => {
      setError(null)
      try {
        const [p, l] = await Promise.all([window.revio.getPull(pull, maxAgeMs), window.revio.getLocalState(pull)])
        setPr(p)
        loaded.current(p, l)
        setGuides(await window.revio.resolveGuidelines(pull.repo, p.files.map((f) => f.path)))
        if (Date.now() - new Date(p.fetchedAt).getTime() > FRESH_ENOUGH_MS)
          window.revio
            .getPull(pull)
            .then(showPr)
            .catch(() => {})
      } catch (e) {
        setError(errorMessage(e))
      }
    },
    [pull, showPr],
  )

  useEffect(() => {
    void load(PREFETCH_MAX_AGE_MS)
  }, [load])

  useEffect(() => {
    window.revio
      .getStack(pull)
      .then(setStack)
      .catch(() => setStack(null))
  }, [pull])

  /** Posts a reply right away and refetches so it shows. */
  const replyNow = useCallback(
    async (commentId: number, body: string) => {
      await window.revio.replyToComment(pull, commentId, body)
      showPr(await window.revio.getPull(pull))
    },
    [pull, showPr],
  )

  return { pr, guides, error, stack, reload: () => load(), replyNow }
}
