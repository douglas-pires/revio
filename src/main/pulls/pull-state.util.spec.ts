import type { PullLocalState } from '@shared/pull.types.ts'
import { describe, expect, it } from 'vitest'
import { pruneStalePulls } from './pull-state.util.ts'

const DAY = 864e5
const NOW = Date.parse('2026-11-16T12:00:00Z')
const makeState = (touchedAt?: string): PullLocalState => {
  const state: PullLocalState = { drafts: [], viewed: {} }
  if (touchedAt) {
    state.touchedAt = touchedAt
  }
  return state
}

describe('pruneStalePulls', () => {
  it('drops PRs untouched for 45 days and keeps recent ones', () => {
    const out = pruneStalePulls(
      {
        old: makeState(new Date(NOW - 46 * DAY).toISOString()),
        recent: makeState(new Date(NOW - 44 * DAY).toISOString()),
      },
      NOW,
    )
    expect(Object.keys(out)).toEqual(['recent'])
  })

  it('starts the clock now for entries saved before touchedAt existed', () => {
    const out = pruneStalePulls({ legacy: makeState() }, NOW)
    expect(out.legacy).toMatchObject({ touchedAt: new Date(NOW).toISOString() })
  })
})
