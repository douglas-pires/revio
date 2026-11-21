import { describe, expect, it } from 'vitest'
import { makeGuideline } from '../../../test/fixtures.ts'
import type { SyncSnapshot } from './sync.types.ts'
import { mergeSnapshots, parseSyncFile, SYNC_FORMAT, sameSnapshot } from './sync-merge.util.ts'

const NOW = Date.parse('2026-11-20T12:00:00Z')

function makeSnapshot(over: Partial<SyncSnapshot> = {}): SyncSnapshot {
  return { format: SYNC_FORMAT, settings: {}, guidelines: [], deletedGuidelines: {}, ...over }
}

const makeGuide = (id: string, updatedAt: string, title = id) => ({ ...makeGuideline(id, '*'), updatedAt, title })

describe('mergeSnapshots: settings', () => {
  it('keeps the later change of each setting, from either side', () => {
    const local = makeSnapshot({
      settings: {
        pollIntervalMinutes: { value: 5, updatedAt: '2026-11-20T10:00:00Z' },
        ignoreDrafts: { value: false, updatedAt: '2026-11-19T10:00:00Z' },
      },
    })
    const remote = makeSnapshot({
      settings: {
        pollIntervalMinutes: { value: 10, updatedAt: '2026-11-20T09:00:00Z' },
        ignoreDrafts: { value: true, updatedAt: '2026-11-20T09:00:00Z' },
      },
    })
    const out = mergeSnapshots(local, remote, NOW)
    expect(out.settings.pollIntervalMinutes?.value).toBe(5)
    expect(out.settings.ignoreDrafts?.value).toBe(true)
  })

  it('lets any change beat a value never changed, and the synced copy win between two never changed', () => {
    const local = makeSnapshot({
      settings: {
        claudeModel: { value: 'mine', updatedAt: null },
        staleAfterHours: { value: 48, updatedAt: null },
      },
    })
    const remote = makeSnapshot({
      settings: {
        claudeModel: { value: 'theirs', updatedAt: null },
        staleAfterHours: { value: 12, updatedAt: '2026-11-01T00:00:00Z' },
      },
    })
    const out = mergeSnapshots(local, remote, NOW)
    expect(out.settings.claudeModel?.value).toBe('theirs')
    expect(out.settings.staleAfterHours?.value).toBe(12)
  })

  it('keeps a setting only one side has', () => {
    const local = makeSnapshot({ settings: { notifyOnStale: { value: false, updatedAt: '2026-11-20T00:00:00Z' } } })
    expect(mergeSnapshots(local, makeSnapshot(), NOW).settings.notifyOnStale?.value).toBe(false)
    expect(mergeSnapshots(makeSnapshot(), local, NOW).settings.notifyOnStale?.value).toBe(false)
  })
})

describe('mergeSnapshots: guides', () => {
  it('unions the guides and keeps the later edit of each', () => {
    const local = makeSnapshot({
      guidelines: [makeGuide('a', '2026-11-20T10:00:00Z', 'mine'), makeGuide('b', '2026-11-01T00:00:00Z')],
    })
    const remote = makeSnapshot({
      guidelines: [makeGuide('a', '2026-11-19T10:00:00Z', 'theirs'), makeGuide('c', '2026-11-02T00:00:00Z')],
    })
    const out = mergeSnapshots(local, remote, NOW)
    expect(out.guidelines.map((guideline) => [guideline.id, guideline.title])).toEqual([
      ['a', 'mine'],
      ['b', 'b'],
      ['c', 'c'],
    ])
  })

  it('drops a guide deleted after its last edit, on whichever side it was deleted', () => {
    const local = makeSnapshot({ guidelines: [makeGuide('a', '2026-11-10T00:00:00Z')] })
    const remote = makeSnapshot({ deletedGuidelines: { a: '2026-11-15T00:00:00Z' } })
    const out = mergeSnapshots(local, remote, NOW)
    expect(out.guidelines).toEqual([])
    expect(out.deletedGuidelines).toEqual({ a: '2026-11-15T00:00:00Z' })
    expect(mergeSnapshots(remote, local, NOW).guidelines).toEqual([])
  })

  it('keeps a guide edited after another Mac deleted it', () => {
    const local = makeSnapshot({ guidelines: [makeGuide('a', '2026-11-16T00:00:00Z')] })
    const remote = makeSnapshot({ deletedGuidelines: { a: '2026-11-15T00:00:00Z' } })
    expect(mergeSnapshots(local, remote, NOW).guidelines.map((guideline) => guideline.id)).toEqual(['a'])
  })

  it('keeps the latest time of a deletion and forgets deletions older than 90 days', () => {
    const local = makeSnapshot({ deletedGuidelines: { a: '2026-11-15T00:00:00Z', old: '2026-01-01T00:00:00Z' } })
    const remote = makeSnapshot({ deletedGuidelines: { a: '2026-11-18T00:00:00Z' } })
    expect(mergeSnapshots(local, remote, NOW).deletedGuidelines).toEqual({ a: '2026-11-18T00:00:00Z' })
  })
})

describe('mergeSnapshots: convergence', () => {
  it('gives the same result whichever Mac merges first', () => {
    const localSnapshot = makeSnapshot({
      settings: { claudeModel: { value: 'a', updatedAt: '2026-11-20T01:00:00Z' } },
      guidelines: [makeGuide('x', '2026-11-20T01:00:00Z', 'a')],
    })
    const remoteSnapshot = makeSnapshot({
      settings: { claudeModel: { value: 'b', updatedAt: '2026-11-20T02:00:00Z' } },
      guidelines: [makeGuide('x', '2026-11-20T00:00:00Z', 'b'), makeGuide('y', '2026-11-20T00:00:00Z')],
      deletedGuidelines: { z: '2026-11-19T00:00:00Z' },
    })
    expect(
      sameSnapshot(
        mergeSnapshots(localSnapshot, remoteSnapshot, NOW),
        mergeSnapshots(remoteSnapshot, localSnapshot, NOW),
      ),
    ).toBe(true)
  })

  it('changes nothing when merging a snapshot with itself', () => {
    const localSnapshot = makeSnapshot({
      guidelines: [makeGuide('x', '2026-11-20T01:00:00Z')],
      deletedGuidelines: { y: '2026-11-19T00:00:00Z' },
    })
    expect(sameSnapshot(mergeSnapshots(localSnapshot, localSnapshot, NOW), localSnapshot)).toBe(true)
  })
})

describe('sameSnapshot', () => {
  it('ignores the order of guides and keys', () => {
    const g1 = makeGuide('a', '2026-11-20T00:00:00Z')
    const g2 = makeGuide('b', '2026-11-20T00:00:00Z')
    expect(sameSnapshot(makeSnapshot({ guidelines: [g1, g2] }), makeSnapshot({ guidelines: [g2, g1] }))).toBe(true)
    expect(sameSnapshot(makeSnapshot({ guidelines: [g1] }), makeSnapshot({ guidelines: [g2] }))).toBe(false)
  })
})

describe('parseSyncFile', () => {
  it('keeps the valid parts and drops unknown or invalid ones', () => {
    const text = JSON.stringify({
      format: SYNC_FORMAT,
      settings: {
        pollIntervalMinutes: { value: 4, updatedAt: '2026-11-20T00:00:00Z' },
        staleAfterHours: { value: 'soon', updatedAt: '2026-11-20T00:00:00Z' },
        claudeBackend: { value: 'nope', updatedAt: null },
        githubTokenEnc: { value: 'secret', updatedAt: null },
      },
      guidelines: [makeGuide('a', '2026-11-20T00:00:00Z'), { id: 'broken' }],
      deletedGuidelines: { b: '2026-11-19T00:00:00Z' },
    })
    const parsed = parseSyncFile(text)
    if (!parsed.ok) {
      throw new Error(parsed.error)
    }
    const read = parsed.snapshot
    expect(Object.keys(read.settings)).toEqual(['pollIntervalMinutes'])
    expect(read.guidelines.map((guideline) => guideline.id)).toEqual(['a'])
    expect(read.deletedGuidelines).toEqual({ b: '2026-11-19T00:00:00Z' })
  })

  it('may replace a broken file but not one a newer Revio wrote', () => {
    expect(parseSyncFile('{not json')).toMatchObject({ ok: false, replaceable: true })
    expect(parseSyncFile(JSON.stringify({ format: SYNC_FORMAT + 1 }))).toMatchObject({ ok: false, replaceable: false })
  })
})
