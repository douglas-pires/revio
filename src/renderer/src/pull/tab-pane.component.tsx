import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { cx } from '../common/format.util.ts'

/**
 * One tab's own scroll area. It mounts the first time the tab is shown and then stays mounted while hidden, so the
 * tab keeps its state, and it puts the scroll position back when the tab is shown again (a hidden element loses it).
 */
export function TabPane({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active)
  const scroller = useRef<HTMLDivElement>(null)
  const scrollTop = useRef(0)
  if (active && !visited) {
    setVisited(true)
  }

  useLayoutEffect(() => {
    if (active && scroller.current) {
      scroller.current.scrollTop = scrollTop.current
    }
  }, [active])

  if (!visited) {
    return null
  }
  return (
    <div
      ref={scroller}
      data-scroll-root={true}
      onScroll={(e) => {
        if (active) {
          scrollTop.current = e.currentTarget.scrollTop
        }
      }}
      className={cx('min-h-0 flex-1 overflow-x-hidden overflow-y-auto', !active && 'hidden')}
    >
      {children}
    </div>
  )
}
