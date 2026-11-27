import { useCallback, useEffect, useRef } from 'react'
import { findFileInView } from './file-in-view.util.ts'

/** How long after a click or jump the scrolling it causes still belongs to it, in ms. */
export const MOVE_SETTLE_MS = 600

/**
 * Whose file the reading line picks after a scroll: right after you clicked or jumped to a file, that file stays
 * current while any of it shows (a short file near the end cannot reach the top); after that, the file you scrolled to.
 */
export function pickKeptFile(current: string | null, sinceMoveMs: number) {
  if (sinceMoveMs < MOVE_SETTLE_MS) {
    return current
  }
  return null
}

/**
 * Makes the file you scroll to current, so the files list follows the diff. `markMoved` is called on a click or
 * jump, whose own scrolling should not move the highlight away from where you went.
 */
export function useFileScrollSpy(opts: {
  active: boolean
  current: string | null
  setCurrent: (path: string) => void
}) {
  const { active, setCurrent } = opts
  const lastMoveAt = useRef(0)
  const current = useRef(opts.current)
  current.current = opts.current

  useEffect(() => {
    if (!active) {
      return
    }
    let frame = 0
    const follow = () => {
      frame = 0
      const kept = pickKeptFile(current.current, performance.now() - lastMoveAt.current)
      const inView = findFileInView(kept)
      if (inView !== null && inView !== current.current) {
        setCurrent(inView)
      }
    }
    const onScroll = (event: Event) => {
      if (frame === 0 && event.target instanceof HTMLElement && event.target.matches('[data-scroll-root]')) {
        frame = requestAnimationFrame(follow)
      }
    }
    // Scroll events do not bubble, so they are caught on the way down.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      cancelAnimationFrame(frame)
    }
  }, [active, setCurrent])

  const markMoved = useCallback(() => {
    lastMoveAt.current = performance.now()
  }, [])
  return { markMoved }
}
