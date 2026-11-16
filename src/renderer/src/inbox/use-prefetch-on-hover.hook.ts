import type { PullRef } from '@shared/pull.types'
import { useCallback, useEffect, useRef } from 'react'

/** Hovering this long counts as intent to open (shorter would fetch every row the pointer crosses). */
const INTENT_DELAY_MS = 150
/** Matches the PR page's "show the cached copy" window. */
const MAX_AGE_MS = 2 * 60_000

/** Returns mouse handlers that warm the PR cache once the pointer rests on a row. */
export function usePrefetchOnHover() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])
  useEffect(() => cancel, [cancel])

  return useCallback(
    (pull: PullRef) => ({
      onMouseEnter: () => {
        cancel()
        timer.current = setTimeout(() => void window.revio.getPull({ repo: pull.repo, number: pull.number }, MAX_AGE_MS).catch(() => {}), INTENT_DELAY_MS)
      },
      onMouseLeave: cancel,
    }),
    [cancel],
  )
}
