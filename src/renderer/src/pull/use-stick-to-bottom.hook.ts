import { type RefObject, useCallback, useRef, useState } from 'react'

/** How close to the bottom still counts as reading the latest, in px: a wheel tick or two of slack. */
const NEAR_BOTTOM_PX = 48

interface ScrollBox {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

export function isNearBottom(box: ScrollBox) {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= NEAR_BOTTOM_PX
}

/**
 * Keeps a scroll area at its bottom as text streams in, but only while you are reading there: scroll up and it stays
 * where you put it until you come back down (or `jump`). `away` says when newer text is out of view.
 */
export function useStickToBottom(scroller: RefObject<HTMLElement | null>) {
  // Changed only by scrolling, never by content growing, so a long answer cannot take the reader back down.
  const pinned = useRef(true)
  const [away, setAway] = useState(false)
  const onScroll = useCallback(() => {
    const el = scroller.current
    if (!el) {
      return
    }
    pinned.current = isNearBottom(el)
    setAway(!pinned.current)
  }, [scroller])
  /** After content changes: back to the bottom, if that is where you were. */
  const follow = useCallback(() => {
    const el = scroller.current
    if (el && pinned.current) {
      el.scrollTo({ top: el.scrollHeight })
    }
  }, [scroller])
  /** To the bottom, following again: on sending a question, or the "Latest" button. */
  const jump = useCallback(() => {
    pinned.current = true
    setAway(false)
    const el = scroller.current
    el?.scrollTo({ top: el.scrollHeight })
  }, [scroller])
  return { away, onScroll, follow, jump }
}
