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
    const element = scroller.current
    if (!element) {
      return
    }
    pinned.current = isNearBottom(element)
    setAway(!pinned.current)
  }, [scroller])
  /** After content changes: back to the bottom, if that is where you were. */
  const follow = useCallback(() => {
    const element = scroller.current
    if (element && pinned.current) {
      element.scrollTo({ top: element.scrollHeight })
    }
  }, [scroller])
  /** To the bottom, following again: on sending a question, or the "Latest" button. */
  const jump = useCallback(() => {
    pinned.current = true
    setAway(false)
    const element = scroller.current
    element?.scrollTo({ top: element.scrollHeight })
  }, [scroller])
  return { away, onScroll, follow, jump }
}
