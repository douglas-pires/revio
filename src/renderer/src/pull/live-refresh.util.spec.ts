import { describe, expect, it, vi } from 'vitest'
import { createVisibleRefresher } from './live-refresh.util.ts'

const FRESH_ENOUGH_MS = 15_000

/** A refresher on a fake clock and window, with the number of refetches it asked for. */
function setUp() {
  let clock = 0
  let visible = true
  const refresh = vi.fn()
  const refresher = createVisibleRefresher({
    refresh,
    isVisible: () => visible,
    now: () => clock,
    freshEnoughMs: FRESH_ENOUGH_MS,
  })
  return {
    refresher,
    refresh,
    advance: (ms: number) => {
      clock += ms
    },
    setVisible: (value: boolean) => {
      visible = value
    },
  }
}

describe('createVisibleRefresher', () => {
  it('refetches on each tick while the window is visible, and not while it is hidden', () => {
    const { refresher, refresh, setVisible } = setUp()
    refresher.refreshIfVisible()
    expect(refresh).toHaveBeenCalledTimes(1)
    setVisible(false)
    refresher.refreshIfVisible()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refetches when you come back only if the last refetch is older than the fresh-enough window', () => {
    const { refresher, refresh, advance } = setUp()
    advance(FRESH_ENOUGH_MS - 1)
    refresher.refreshIfStale()
    expect(refresh).not.toHaveBeenCalled()
    advance(2)
    refresher.refreshIfStale()
    expect(refresh).toHaveBeenCalledTimes(1)
    refresher.refreshIfStale()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not count a hidden tick as a refetch, so coming back still refetches', () => {
    const { refresher, refresh, advance, setVisible } = setUp()
    advance(FRESH_ENOUGH_MS + 1)
    setVisible(false)
    refresher.refreshIfVisible()
    setVisible(true)
    refresher.refreshIfStale()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
