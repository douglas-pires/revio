import { type RefObject, useEffect, useState } from 'react'

/** Distance from the visible area at which a file starts rendering, and at which it may stop. */
const ENTER_MARGIN = '1200px 0px'
const LEAVE_MARGIN = '4000px 0px'

/**
 * Whether an element is near its scroll container's visible area. Uses two observers for hysteresis:
 * it turns on within ENTER_MARGIN and only turns off beyond LEAVE_MARGIN, so content doesn't flicker
 * while scrolling back and forth. The scroll container is the closest `[data-scroll-root]` ancestor.
 */
export function useNearViewport(ref: RefObject<HTMLElement | null>, keepAlive: boolean) {
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const root = el.closest<HTMLElement>('[data-scroll-root]')
    const enter = new IntersectionObserver(([entry]) => entry?.isIntersecting && setNear(true), {
      root,
      rootMargin: ENTER_MARGIN,
    })
    const leave = new IntersectionObserver(([entry]) => entry && !entry.isIntersecting && setNear(false), {
      root,
      rootMargin: LEAVE_MARGIN,
    })
    enter.observe(el)
    leave.observe(el)
    return () => {
      enter.disconnect()
      leave.disconnect()
    }
  }, [ref])

  return near || keepAlive
}
