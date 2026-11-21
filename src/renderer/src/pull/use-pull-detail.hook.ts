import type { ResolvedGuideline } from '@shared/guideline.types.ts'
import type { Stack } from '@shared/inbox.types.ts'
import type { PullDetail, PullLocalState, PullRef } from '@shared/pull.types.ts'
import { MS_PER_MINUTE } from '@shared/time.util.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../common/format.util.ts'
import { createVisibleRefresher } from './live-refresh.util.ts'
import { hasSameContent } from './pull-content.util.ts'
import { knownStackOf, rememberStack } from './stack-memory.util.ts'

/** A prefetched copy this recent is shown immediately. */
const PREFETCH_MAX_AGE_MS = 2 * MS_PER_MINUTE
/** Copies older than this are refreshed in the background after showing. */
const FRESH_ENOUGH_MS = 15_000
/** How often an open PR checks GitHub for new comments and replies. */
const LIVE_REFRESH_MS = MS_PER_MINUTE

/** The current copy when a refetch changed nothing, so memoized views stay put; else the new one. */
function keepIfSame(prev: PullDetail | null, next: PullDetail) {
  if (prev !== null && hasSameContent(prev, next)) {
    return prev
  }
  return next
}

/**
 * The stack the PR belongs to, or null when it is not stacked (or the lookup failed). Moving along a stack starts
 * from the stack you came from, so its bar shows at once instead of after the lookup.
 */
function usePullStack(pull: PullRef) {
  const [stack, setStack] = useState<Stack | null>(() => knownStackOf(pull))
  useEffect(() => {
    globalThis.revio
      .getStack(pull)
      .then((found) => {
        if (found) {
          rememberStack(found)
        }
        setStack(found)
      })
      .catch(() => setStack(null))
  }, [pull])
  return stack
}

/** Fetches a fresh copy behind the one on screen; a failure keeps the copy shown. */
function refreshInBackground(pull: PullRef, show: (pr: PullDetail) => void) {
  globalThis.revio
    .getPull(pull)
    .then(show)
    .catch(() => {
      // The copy on screen stays; the next open fetches again.
    })
}

/**
 * Keeps an open PR current, so replies and new comments show up without reopening it: refetches every
 * `LIVE_REFRESH_MS` while the window is visible, and at once when you come back to it.
 */
function useLiveRefresh(pull: PullRef, showPull: (pr: PullDetail) => void) {
  useEffect(() => {
    const { refreshIfVisible, refreshIfStale } = createVisibleRefresher({
      refresh: () => refreshInBackground(pull, showPull),
      isVisible: () => document.visibilityState === 'visible',
      now: () => Date.now(),
      freshEnoughMs: FRESH_ENOUGH_MS,
    })
    const timer = setInterval(refreshIfVisible, LIVE_REFRESH_MS)
    globalThis.addEventListener('focus', refreshIfStale)
    document.addEventListener('visibilitychange', refreshIfStale)
    return () => {
      clearInterval(timer)
      globalThis.removeEventListener('focus', refreshIfStale)
      document.removeEventListener('visibilitychange', refreshIfStale)
    }
  }, [pull, showPull])
}

/**
 * The PR, its local review state, the guides that apply and its stack. Shows a recent copy right away
 * when one exists (e.g. prefetched on hover), then refreshes it. `onLoaded` runs after every full load.
 */
export function usePullDetail(pull: PullRef, onLoaded: (pr: PullDetail, local: PullLocalState) => void) {
  const [pr, setPr] = useState<PullDetail | null>(null)
  const [guides, setGuides] = useState<ResolvedGuideline[]>([])
  const [error, setError] = useState<string | null>(null)
  const stack = usePullStack(pull)
  const loaded = useRef(onLoaded)
  loaded.current = onLoaded
  /** A refetch that changed nothing keeps the current object, so memoized views stay put. */
  const showPr = useCallback((next: PullDetail) => setPr((prev) => keepIfSame(prev, next)), [])

  const load = useCallback(
    async (maxAgeMs = 0) => {
      setError(null)
      try {
        const [p, l] = await Promise.all([
          globalThis.revio.getPull(pull, maxAgeMs),
          globalThis.revio.getLocalState(pull),
        ])
        setPr(p)
        loaded.current(p, l)
        setGuides(
          await globalThis.revio.resolveGuidelines(
            pull.repo,
            p.files.map((f) => f.path),
          ),
        )
        if (Date.now() - new Date(p.fetchedAt).getTime() > FRESH_ENOUGH_MS) {
          refreshInBackground(pull, showPr)
        }
      } catch (e) {
        setError(errorMessage(e))
      }
    },
    [pull, showPr],
  )

  useEffect(() => {
    load(PREFETCH_MAX_AGE_MS)
  }, [load])

  useLiveRefresh(pull, showPr)

  /** Posts a reply right away and refetches so it shows. */
  const replyNow = useCallback(
    async (commentId: number, body: string) => {
      await globalThis.revio.replyToComment(pull, commentId, body)
      showPr(await globalThis.revio.getPull(pull))
    },
    [pull, showPr],
  )

  return { pr, guides, error, stack, reload: () => load(), replyNow }
}
