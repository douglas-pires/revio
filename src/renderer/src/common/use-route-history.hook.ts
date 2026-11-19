import { useCallback, useEffect, useState } from 'react'
import {
  canGoBack,
  canGoForward,
  currentEntry,
  type NavHistory,
  startHistory,
  step,
  visit,
} from './nav-history.util.ts'
import { type Route, sameRoute, withoutTarget } from './route.types.ts'

/** Mouse side buttons, as browsers number them. */
const MOUSE_BACK = 3
const MOUSE_FORWARD = 4

/**
 * The current screen with back/forward history. Moves with the on-screen arrows, the Go menu (⌘[ / ⌘]),
 * trackpad swipes (sent by the main process) and the mouse's side buttons.
 */
export function useRouteHistory(first: Route) {
  const [history, setHistory] = useState<NavHistory<Route>>(() => startHistory(first))

  const go = useCallback((route: Route) => setHistory((h) => visit(h, route, sameRoute)), [])
  const move = useCallback((delta: -1 | 1) => {
    setHistory((h) => {
      const next = step(h, delta)
      if (next === h) {
        return h
      }
      // Arriving again should not re-run a one-time jump (e.g. opening a reply box).
      const entries = [...next.entries]
      entries[next.index] = withoutTarget(currentEntry(next))
      return { entries, index: next.index }
    })
  }, [])
  const back = useCallback(() => move(-1), [move])
  const forward = useCallback(() => move(1), [move])

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (e.button === MOUSE_BACK) {
        back()
      }
      if (e.button === MOUSE_FORWARD) {
        forward()
      }
    }
    const navigate = { back, forward }
    globalThis.addEventListener('mouseup', onMouse)
    const off = globalThis.revio.onEvent((e) => {
      if (e.type === 'navigate') {
        navigate[e.direction]()
      }
    })
    return () => {
      globalThis.removeEventListener('mouseup', onMouse)
      off()
    }
  }, [back, forward])

  return {
    route: currentEntry(history),
    go,
    back,
    forward,
    canGoBack: canGoBack(history),
    canGoForward: canGoForward(history),
  }
}
