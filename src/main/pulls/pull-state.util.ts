import type { PullLocalState } from '@shared/pull.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'

const PULL_STATE_TTL_DAYS = 45
/** Local state for PRs untouched this long (merged, closed, abandoned) is dropped on startup. */
const PULL_STATE_TTL_MS = PULL_STATE_TTL_DAYS * MS_PER_DAY

export function pruneStalePulls(
  pulls: Record<string, PullLocalState>,
  now = Date.now(),
): Record<string, PullLocalState> {
  const kept: Record<string, PullLocalState> = {}
  for (const [key, state] of Object.entries(pulls)) {
    // Entries saved before touchedAt existed start their clock now.
    const touched = (state.touchedAt && Date.parse(state.touchedAt)) || now
    if (now - touched < PULL_STATE_TTL_MS) {
      kept[key] = { ...state, touchedAt: state.touchedAt ?? new Date(now).toISOString() }
    }
  }
  return kept
}
