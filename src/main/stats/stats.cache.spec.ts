import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StatsData, StatsScope } from '@shared/stats.types.ts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatsCache } from './stats.cache.ts'

const ME: StatsScope = { kind: 'me' }
const makeData = (fetchedAt: string): StatsData => ({
  scope: ME,
  days: 30,
  viewer: 'mara',
  people: ['mara'],
  pulls: [],
  truncated: false,
  fetchedAt,
})

let folder = ''
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'revio-stats-'))
})
afterEach(() => rm(folder, { recursive: true, force: true }))

describe('StatsCache', () => {
  it('uses a copy younger than half an hour, and fetches again when asked fresh', async () => {
    const fetch = vi.fn(async () => makeData(new Date().toISOString()))
    const cache = new StatsCache(fetch, folder)
    await cache.get(ME, 30, false)
    await cache.get(ME, 30, false)
    expect(fetch).toHaveBeenCalledTimes(1)
    await cache.get(ME, 30, true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps the last stats on disk for the next run, however old', async () => {
    const old = makeData('2026-01-01T00:00:00Z')
    await new StatsCache(async () => old, folder).get(ME, 30, true)
    const nextRun = new StatsCache(async () => makeData(new Date().toISOString()), folder)
    expect(await nextRun.readSaved(ME, 30)).toEqual(old)
    expect(await nextRun.readSaved(ME, 90)).toBeNull()
  })

  it('treats the same teams in another order as one scope', async () => {
    const web = { org: 'acme', slug: 'web', name: 'Web' }
    const api = { org: 'acme', slug: 'api', name: 'API' }
    const fetch = vi.fn(async () => makeData(new Date().toISOString()))
    const cache = new StatsCache(fetch, folder)
    await cache.get({ kind: 'team', teams: [web, api] }, 30, false)
    await cache.get({ kind: 'team', teams: [api, web] }, 30, false)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
