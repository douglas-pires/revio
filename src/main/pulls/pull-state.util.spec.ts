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
    const output = pruneStalePulls(
      {
        old: makeState(new Date(NOW - 46 * DAY).toISOString()),
        recent: makeState(new Date(NOW - 44 * DAY).toISOString()),
      },
      NOW,
    )
    expect(Object.keys(output)).toEqual(['recent'])
  })

  it('starts the clock now for entries saved before touchedAt existed', () => {
    const output = pruneStalePulls({ legacy: makeState() }, NOW)
    expect(output.legacy).toMatchObject({ touchedAt: new Date(NOW).toISOString() })
  })
})
