import type { StatsData } from '@shared/stats.types.ts'
import { describe, expect, it } from 'vitest'
import { isStatsFor } from './stats-scope-memory.util.ts'

const WEB = { org: 'acme', slug: 'web', name: 'Web' }
const API = { org: 'acme', slug: 'api', name: 'API' }
const loaded = (scope: StatsData['scope'], days: StatsData['days'] = 30) => ({ scope, days }) as StatsData

describe('isStatsFor', () => {
  it('matches the same scope and period', () => {
    expect(isStatsFor(loaded({ kind: 'me' }), { kind: 'me' }, '30')).toBe(true)
    expect(isStatsFor(loaded({ kind: 'me' }), { kind: 'me' }, '90')).toBe(false)
  })

  it('treats the same teams in another order as the same', () => {
    const scope: StatsData['scope'] = { kind: 'team', teams: [WEB, API] }
    expect(isStatsFor(loaded({ kind: 'team', teams: [API, WEB] }), scope, '30')).toBe(true)
    expect(isStatsFor(loaded({ kind: 'team', teams: [WEB] }), scope, '30')).toBe(false)
  })

  it('tells repositories apart', () => {
    expect(isStatsFor(loaded({ kind: 'repo', repo: 'acme/web' }), { kind: 'repo', repo: 'acme/api' }, '30')).toBe(false)
  })
})
