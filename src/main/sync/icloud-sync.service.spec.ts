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
    apply: (snapshot) => {
      state.snapshot = snapshot
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
    const firstMac = mac(drive, {
      settings: { claudeModel: { value: 'from-a', updatedAt: '2026-11-20T00:00:00Z' } },
      guidelines: [{ ...makeGuideline('g', '*'), updatedAt: '2026-11-20T00:00:00Z' }],
    })
    const secondMac = mac(drive)
    expect(firstMac.sync.syncNow().state).toBe('synced')
    secondMac.sync.syncNow()
    expect(secondMac.state.snapshot.settings.claudeModel?.value).toBe('from-a')
    expect(secondMac.state.snapshot.guidelines.map((guideline) => guideline.id)).toEqual(['g'])

    const written = readFileSync(syncFile(), 'utf8')
    firstMac.sync.syncNow()
    secondMac.sync.syncNow()
    expect(firstMac.state.applied).toBe(0)
    expect(secondMac.state.applied).toBe(1)
    expect(readFileSync(syncFile(), 'utf8')).toBe(written)
  })

  it('never writes a secret, even one the local snapshot happens to carry', () => {
    const firstMac = mac(drive, {
      settings: { githubTokenEnc: { value: 'secret', updatedAt: null } } as SyncSnapshot['settings'],
    })
    firstMac.sync.syncNow()
    const secondMac = mac(drive)
    secondMac.sync.syncNow()
    expect(secondMac.state.snapshot.settings).toEqual({})
  })
})

describe('IcloudSync: files iCloud left', () => {
  it('folds in conflict copies iCloud made and removes them', () => {
    const thisMac = mac(drive)
    thisMac.sync.syncNow()
    const copy = {
      format: SYNC_FORMAT,
      settings: { ignoreDrafts: { value: false, updatedAt: '2026-11-20T00:00:00Z' } },
      guidelines: [],
      deletedGuidelines: {},
    }
    writeFileSync(join(drive, 'Revio', 'settings-sync 2.json'), JSON.stringify(copy))
    thisMac.sync.syncNow()
    expect(thisMac.state.snapshot.settings.ignoreDrafts?.value).toBe(false)
    expect(readdirSync(join(drive, 'Revio'))).toEqual(['settings-sync.json'])
  })

  it('leaves a file from a newer Revio alone', () => {
    mkdirSync(join(drive, 'Revio'))
    const newer = JSON.stringify({ format: SYNC_FORMAT + 1 })
    writeFileSync(syncFile(), newer)
    const thisMac = mac(drive)
    expect(thisMac.sync.syncNow().state).toBe('error')
    expect(readFileSync(syncFile(), 'utf8')).toBe(newer)
  })

  it('asks iCloud to download a file it only has a placeholder for', () => {
    mkdirSync(join(drive, 'Revio'))
    writeFileSync(join(drive, 'Revio', '.settings-sync.json.icloud'), '')
    const thisMac = mac(drive)
    expect(thisMac.sync.syncNow().state).toBe('downloading')
    expect(thisMac.download).toHaveBeenCalledWith(syncFile())
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
