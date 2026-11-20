import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeGuideline } from '../../../test/fixtures.ts'
import { IcloudSync } from './icloud-sync.service.ts'
import type { SyncSnapshot } from './sync.types.ts'
import { SYNC_FORMAT } from './sync-merge.util.ts'

/** A Mac in the test: its own copy of the synced state, and a sync service over the shared drive. */
function mac(folder: string, initial: Partial<SyncSnapshot> = {}) {
  const state = {
    enabled: true,
    snapshot: { format: SYNC_FORMAT, settings: {}, guidelines: [], deletedGuidelines: {}, ...initial } as SyncSnapshot,
    applied: 0,
  }
  const download = vi.fn()
  const sync = new IcloudSync({
    drive: folder,
    enabled: () => state.enabled,
    local: () => state.snapshot,
    apply: (s) => {
      state.snapshot = s
      state.applied += 1
    },
    onStatus: () => undefined,
    download,
  })
  return { state, sync, download }
}

let drive: string

beforeEach(() => {
  drive = mkdtempSync(join(tmpdir(), 'revio-sync-'))
})

afterEach(() => {
  rmSync(drive, { recursive: true, force: true })
})

const syncFile = () => join(drive, 'Revio', 'settings-sync.json')

describe('IcloudSync', () => {
  it('brings one Mac’s settings and guides to another, and changes nothing once they agree', () => {
    const a = mac(drive, {
      settings: { claudeModel: { value: 'from-a', updatedAt: '2026-11-20T00:00:00Z' } },
      guidelines: [{ ...makeGuideline('g', '*'), updatedAt: '2026-11-20T00:00:00Z' }],
    })
    const b = mac(drive)
    expect(a.sync.syncNow().state).toBe('synced')
    b.sync.syncNow()
    expect(b.state.snapshot.settings.claudeModel?.value).toBe('from-a')
    expect(b.state.snapshot.guidelines.map((g) => g.id)).toEqual(['g'])

    const written = readFileSync(syncFile(), 'utf8')
    a.sync.syncNow()
    b.sync.syncNow()
    expect(a.state.applied).toBe(0)
    expect(b.state.applied).toBe(1)
    expect(readFileSync(syncFile(), 'utf8')).toBe(written)
  })

  it('never writes a secret, even one the local snapshot happens to carry', () => {
    const a = mac(drive, {
      settings: { githubTokenEnc: { value: 'secret', updatedAt: null } } as SyncSnapshot['settings'],
    })
    a.sync.syncNow()
    const b = mac(drive)
    b.sync.syncNow()
    expect(b.state.snapshot.settings).toEqual({})
  })
})

describe('IcloudSync: files iCloud left', () => {
  it('folds in conflict copies iCloud made and removes them', () => {
    const a = mac(drive)
    a.sync.syncNow()
    const copy = {
      format: SYNC_FORMAT,
      settings: { ignoreDrafts: { value: false, updatedAt: '2026-11-20T00:00:00Z' } },
      guidelines: [],
      deletedGuidelines: {},
    }
    writeFileSync(join(drive, 'Revio', 'settings-sync 2.json'), JSON.stringify(copy))
    a.sync.syncNow()
    expect(a.state.snapshot.settings.ignoreDrafts?.value).toBe(false)
    expect(readdirSync(join(drive, 'Revio'))).toEqual(['settings-sync.json'])
  })

  it('leaves a file from a newer Revio alone', () => {
    mkdirSync(join(drive, 'Revio'))
    const newer = JSON.stringify({ format: SYNC_FORMAT + 1 })
    writeFileSync(syncFile(), newer)
    const a = mac(drive)
    expect(a.sync.syncNow().state).toBe('error')
    expect(readFileSync(syncFile(), 'utf8')).toBe(newer)
  })

  it('asks iCloud to download a file it only has a placeholder for', () => {
    mkdirSync(join(drive, 'Revio'))
    writeFileSync(join(drive, 'Revio', '.settings-sync.json.icloud'), '')
    const a = mac(drive)
    expect(a.sync.syncNow().state).toBe('downloading')
    expect(a.download).toHaveBeenCalledWith(syncFile())
  })

  it('reports iCloud Drive as unavailable when its folder is missing, and does nothing when off', () => {
    const missing = mac(join(drive, 'nope'))
    expect(missing.sync.syncNow().state).toBe('unavailable')
    const off = mac(drive)
    off.state.enabled = false
    expect(off.sync.syncNow().state).toBe('off')
    expect(readdirSync(drive)).toEqual([])
  })
})
