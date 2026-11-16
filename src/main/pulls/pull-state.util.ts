import type { PullLocalState } from '@shared/types'

/** Local state for PRs untouched this long (merged, closed, abandoned) is dropped on startup. */
export const PULL_STATE_TTL_MS = 45 * 24 * 36e5

export function pruneStalePulls(pulls: Record<string, PullLocalState>, now = Date.now()): Record<string, PullLocalState> {
  const kept: Record<string, PullLocalState> = {}
  for (const [key, state] of Object.entries(pulls)) {
    // Entries saved before touchedAt existed start their clock now.
    const touched = state.touchedAt ? new Date(state.touchedAt).getTime() : now
    if (now - touched < PULL_STATE_TTL_MS) kept[key] = { ...state, touchedAt: state.touchedAt ?? new Date(now).toISOString() }
  }
  return kept
}
