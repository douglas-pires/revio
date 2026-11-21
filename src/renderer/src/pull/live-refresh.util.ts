/** What the refresher needs from its surroundings, so it can be tested without a window or a clock. */
export interface RefreshEnvironment {
  /** Fetches the PR again (in the background, keeping the copy on screen if it fails). */
  refresh: () => void
  isVisible: () => boolean
  now: () => number
  /** A refetch younger than this is recent enough to skip when you come back to the window. */
  freshEnoughMs: number
}

/** Refetches the PR only while the window is visible, and skips a refetch when the last one is recent. */
export function createVisibleRefresher({ refresh, isVisible, now, freshEnoughMs }: RefreshEnvironment) {
  let lastRefreshedAt = now()
  const refreshIfVisible = () => {
    if (!isVisible()) {
      return
    }
    lastRefreshedAt = now()
    refresh()
  }
  const refreshIfStale = () => {
    if (now() - lastRefreshedAt > freshEnoughMs) {
      refreshIfVisible()
    }
  }
  return { refreshIfVisible, refreshIfStale }
}
