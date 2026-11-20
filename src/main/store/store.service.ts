import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Guideline } from '@shared/guideline.types.ts'
import type { PullLocalState } from '@shared/pull.types.ts'
import type { Settings } from '@shared/settings.types.ts'
import { DEFAULT_OPEN_IN_EDITOR_SHORTCUT } from '@shared/shortcut.util.ts'
import { app, safeStorage } from 'electron'
import type { AlertState } from '../alerts/alerts.util.ts'
import { pruneStalePulls } from '../pulls/pull-state.util.ts'
import type { SyncedSettingKey, SyncSnapshot } from '../sync/sync.types.ts'
import { isSyncedSetting, SYNC_FORMAT, SYNCED_SETTING_KEYS } from '../sync/sync-merge.util.ts'

/** Writes are batched: a burst of changes within this window is saved once. */
const SAVE_DELAY_MS = 150
/** Marks secrets stored without the keychain (when macOS encryption is unavailable). */
const PLAIN_PREFIX = 'plain:'

type StoredSettings = Omit<Settings, 'hasGithubToken' | 'hasAnthropicKey'> & {
  /** Encrypted with the OS keychain via safeStorage, base64. */
  githubTokenEnc?: string | undefined
  anthropicKeyEnc?: string | undefined
}

/** What syncing needs to merge with other Macs: when each synced setting changed, and which guides were deleted. */
interface SyncState {
  settingsUpdatedAt: Partial<Record<SyncedSettingKey, string>>
  deletedGuidelines: Record<string, string>
}

interface Db {
  settings: StoredSettings
  guidelines: Guideline[]
  pulls: Record<string, PullLocalState>
  alerts: AlertState
  sync: SyncState
}

const DEFAULT_SETTINGS: StoredSettings = {
  pollIntervalMinutes: 3,
  staleAfterHours: 24,
  staleRepeatHours: 24,
  includeTeamRequests: true,
  notifyOnRequest: true,
  notifyOnReRequest: true,
  notifyOnStale: true,
  notifyOnMention: true,
  ignoreDrafts: true,
  claudeBackend: 'auto',
  claudeModel: 'claude-opus-5-5',
  editor: '',
  openInEditorShortcut: DEFAULT_OPEN_IN_EDITOR_SHORTCUT,
  codeFolders: [],
  syncViaIcloud: false,
}

const DEFAULT_GUIDELINES: Guideline[] = [
  {
    id: 'global-default',
    repo: '*',
    path: '',
    title: 'How I review',
    enabled: true,
    updatedAt: new Date(0).toISOString(),
    body: [
      '## What matters to me',
      '- Correctness first: edge cases, error handling, data loss, race conditions.',
      '- Security: auth checks, input validation, secrets, injection.',
      '- Public contracts: API shapes, DB migrations, config/env changes.',
      '',
      '## What I usually skip',
      '- Lockfiles, generated code, snapshots, pure formatting changes.',
      '',
      '## Tone',
      '- Ask questions before asserting. Prefix nits with `nit:`.',
    ].join('\n'),
  },
]

const file = () => join(app.getPath('userData'), 'revio.json')

let db: Db | null = null

function load(): Db {
  if (db) {
    return db
  }
  const fresh: Db = {
    settings: { ...DEFAULT_SETTINGS },
    guidelines: DEFAULT_GUIDELINES,
    pulls: {},
    alerts: { requested: {}, staleAlertedAt: {}, seeded: false, mentionsAlerted: {}, mentionsSeeded: false },
    sync: { settingsUpdatedAt: {}, deletedGuidelines: {} },
  }
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Db>
      db = {
        settings: { ...DEFAULT_SETTINGS, ...raw.settings },
        guidelines: raw.guidelines ?? fresh.guidelines,
        pulls: pruneStalePulls(raw.pulls ?? {}),
        alerts: { ...fresh.alerts, ...raw.alerts },
        sync: { ...fresh.sync, ...raw.sync },
      }
      return db
    }
  } catch (err) {
    console.error('Could not read store, starting fresh', err)
  }
  db = fresh
  return db
}

let saveTimer: NodeJS.Timeout | null = null

function save() {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(flush, SAVE_DELAY_MS)
}

function encrypt(value: string) {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }
  return `${PLAIN_PREFIX}${Buffer.from(value).toString('base64')}`
}

/** A secret to store: encrypted, or undefined to clear it (null or an empty string). */
function encryptOrClear(value: string | null) {
  if (!value) {
    return
  }
  return encrypt(value)
}

function decrypt(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  if (value.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(value.slice(PLAIN_PREFIX.length), 'base64').toString()
  }
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch {
    return undefined
  }
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

let onSyncedChange: (() => void) | null = null

/** Tells the sync service that something it syncs changed here. */
function syncedChanged() {
  onSyncedChange?.()
}

/** Notes when each synced setting in the patch changed; true when any did. */
function stampSettings(d: Db, patch: Record<string, unknown>) {
  const now = new Date().toISOString()
  const current = d.settings as unknown as Record<string, unknown>
  let changed = false
  for (const [key, value] of Object.entries(patch)) {
    if (isSyncedSetting(key) && value !== undefined && !sameValue(current[key], value)) {
      d.sync.settingsUpdatedAt[key] = now
      changed = true
    }
  }
  return changed
}

export function flush() {
  if (!db) {
    return
  }
  mkdirSync(app.getPath('userData'), { recursive: true })
  const tmp = `${file()}.tmp`
  writeFileSync(tmp, JSON.stringify(db, null, 2))
  renameSync(tmp, file())
}

export const store = {
  settings(): Settings {
    const { githubTokenEnc, anthropicKeyEnc, ...rest } = load().settings
    return { ...rest, hasGithubToken: Boolean(githubTokenEnc), hasAnthropicKey: Boolean(anthropicKeyEnc) }
  },
  updateSettings(patch: Partial<StoredSettings> & { githubToken?: string | null; anthropicApiKey?: string | null }) {
    const s = load().settings
    const { githubToken, anthropicApiKey, ...rest } = patch
    const synced = stampSettings(load(), rest)
    Object.assign(s, rest)
    if (githubToken !== undefined) {
      s.githubTokenEnc = encryptOrClear(githubToken)
    }
    if (anthropicApiKey !== undefined) {
      s.anthropicKeyEnc = encryptOrClear(anthropicApiKey)
    }
    save()
    if (synced) {
      syncedChanged()
    }
  },
  githubToken: () => decrypt(load().settings.githubTokenEnc),
  anthropicKey: () => decrypt(load().settings.anthropicKeyEnc),

  guidelines: () => load().guidelines,
  /** Replaces the guides, remembering the ones removed so syncing deletes them on your other Macs too. */
  setGuidelines(list: Guideline[]) {
    const d = load()
    const kept = new Set(list.map((g) => g.id))
    const now = new Date().toISOString()
    for (const g of d.guidelines) {
      if (!kept.has(g.id)) {
        d.sync.deletedGuidelines[g.id] = now
      }
    }
    d.guidelines = list
    save()
    syncedChanged()
  },

  /** Calls `listener` whenever a synced setting or a guide changes on this Mac. */
  onSyncedChange(listener: () => void) {
    onSyncedChange = listener
  },
  /** The synced settings and the guides, as syncing merges them. */
  syncSnapshot(): SyncSnapshot {
    const d = load()
    const current = d.settings as unknown as Record<string, unknown>
    const settings = Object.fromEntries(
      SYNCED_SETTING_KEYS.map((key) => [
        key,
        { value: current[key], updatedAt: d.sync.settingsUpdatedAt[key] ?? null },
      ]),
    )
    return {
      format: SYNC_FORMAT,
      settings,
      guidelines: d.guidelines,
      deletedGuidelines: { ...d.sync.deletedGuidelines },
    }
  },
  /** Takes in a merged snapshot without counting it as a change made here; says which settings and whether guides changed. */
  applySyncSnapshot(snapshot: SyncSnapshot): { settings: SyncedSettingKey[]; guidelines: boolean } {
    const d = load()
    const current = d.settings as unknown as Record<string, unknown>
    const stamped = snapshot.settings as Record<string, { value: unknown; updatedAt: string | null } | undefined>
    const changed: SyncedSettingKey[] = []
    for (const key of SYNCED_SETTING_KEYS) {
      const entry = stamped[key]
      if (entry && !sameValue(current[key], entry.value)) {
        current[key] = entry.value
        changed.push(key)
      }
      if (entry?.updatedAt) {
        d.sync.settingsUpdatedAt[key] = entry.updatedAt
      }
    }
    const guidelines = !sameValue(d.guidelines, snapshot.guidelines)
    d.guidelines = snapshot.guidelines
    d.sync.deletedGuidelines = { ...snapshot.deletedGuidelines }
    save()
    return { settings: changed, guidelines }
  },

  pull(key: string): PullLocalState {
    return load().pulls[key] ?? { drafts: [], viewed: {} }
  },
  updatePull(key: string, fn: (s: PullLocalState) => void) {
    const { pulls } = load()
    const state = pulls[key] ?? { drafts: [], viewed: {} }
    fn(state)
    state.touchedAt = new Date().toISOString()
    pulls[key] = state
    save()
  },

  alerts: () => load().alerts,
  saveAlerts: () => save(),
}
