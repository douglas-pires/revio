import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommentKind } from '@shared/comment-kinds.util.ts'
import type { Guideline } from '@shared/guideline.types.ts'
import type { PullLocalState } from '@shared/pull.types.ts'
import type { Settings } from '@shared/settings.types.ts'
import { moveFormerShortcuts } from '@shared/shortcut-actions.util.ts'
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
  /** The last release used here, to show what is new after an update. */
  seenRelease?: string | undefined
  /** What each of your past review comments is about, as Claude sorted them, by the comment's link. */
  commentKinds?: Record<string, CommentKind[]> | undefined
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
  shortcuts: {},
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

const findStoreFile = () => join(app.getPath('userData'), 'revio.json')

let loadedDatabase: Db | null = null
/** Whether Revio was used on this Mac before this run. */
let usedBefore = false

function load(): Db {
  if (loadedDatabase) {
    return loadedDatabase
  }
  const fresh: Db = {
    settings: { ...DEFAULT_SETTINGS },
    guidelines: DEFAULT_GUIDELINES,
    pulls: {},
    alerts: { requested: {}, staleAlertedAt: {}, seeded: false, seenMentions: {}, seenMentionsRecorded: false },
    sync: { settingsUpdatedAt: {}, deletedGuidelines: {} },
  }
  try {
    if (existsSync(findStoreFile())) {
      const raw = JSON.parse(readFileSync(findStoreFile(), 'utf8')) as Partial<Db>
      usedBefore = true
      loadedDatabase = {
        seenRelease: raw.seenRelease,
        commentKinds: raw.commentKinds,
        settings: { ...DEFAULT_SETTINGS, ...moveFormerShortcuts({ ...raw.settings }) },
        guidelines: raw.guidelines ?? fresh.guidelines,
        pulls: pruneStalePulls(raw.pulls ?? {}),
        alerts: { ...fresh.alerts, ...raw.alerts },
        sync: { ...fresh.sync, ...raw.sync },
      }
      return loadedDatabase
    }
  } catch (failure) {
    console.error('Could not read store, starting fresh', failure)
  }
  loadedDatabase = fresh
  return loadedDatabase
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

const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

let onSyncedChange: (() => void) | null = null

/** Tells the sync service that something it syncs changed here. */
function notifySyncedChange() {
  onSyncedChange?.()
}

/** Notes when each synced setting in the patch changed; true when any did. */
function stampSettings(database: Db, patch: Record<string, unknown>) {
  const now = new Date().toISOString()
  const current = database.settings as unknown as Record<string, unknown>
  let changed = false
  for (const [key, value] of Object.entries(patch)) {
    if (isSyncedSetting(key) && value !== undefined && !sameValue(current[key], value)) {
      database.sync.settingsUpdatedAt[key] = now
      changed = true
    }
  }
  return changed
}

export function flush() {
  if (!loadedDatabase) {
    return
  }
  mkdirSync(app.getPath('userData'), { recursive: true })
  const temporaryPath = `${findStoreFile()}.tmp`
  writeFileSync(temporaryPath, JSON.stringify(loadedDatabase, null, 2))
  renameSync(temporaryPath, findStoreFile())
}

export const store = {
  settings(): Settings {
    const { githubTokenEnc, anthropicKeyEnc, ...rest } = load().settings
    return { ...rest, hasGithubToken: Boolean(githubTokenEnc), hasAnthropicKey: Boolean(anthropicKeyEnc) }
  },
  updateSettings(patch: Partial<StoredSettings> & { githubToken?: string | null; anthropicApiKey?: string | null }) {
    const { settings } = load()
    const { githubToken, anthropicApiKey, ...rest } = patch
    const synced = stampSettings(load(), rest)
    Object.assign(settings, rest)
    if (githubToken !== undefined) {
      settings.githubTokenEnc = encryptOrClear(githubToken)
    }
    if (anthropicApiKey !== undefined) {
      settings.anthropicKeyEnc = encryptOrClear(anthropicApiKey)
    }
    save()
    if (synced) {
      notifySyncedChange()
    }
  },
  githubToken: () => decrypt(load().settings.githubTokenEnc),
  anthropicKey: () => decrypt(load().settings.anthropicKeyEnc),

  guidelines: () => load().guidelines,
  /** Replaces the guides, remembering the ones removed so syncing deletes them on your other Macs too. */
  setGuidelines(list: Guideline[]) {
    const database = load()
    const kept = new Set(list.map((guideline) => guideline.id))
    const now = new Date().toISOString()
    for (const guideline of database.guidelines) {
      if (!kept.has(guideline.id)) {
        database.sync.deletedGuidelines[guideline.id] = now
      }
    }
    database.guidelines = list
    save()
    notifySyncedChange()
  },

  /** Calls `listener` whenever a synced setting or a guide changes on this Mac. */
  onSyncedChange(listener: () => void) {
    onSyncedChange = listener
  },
  /** The synced settings and the guides, as syncing merges them. */
  syncSnapshot(): SyncSnapshot {
    const database = load()
    const current = database.settings as unknown as Record<string, unknown>
    const settings = Object.fromEntries(
      SYNCED_SETTING_KEYS.map((key) => [
        key,
        { value: current[key], updatedAt: database.sync.settingsUpdatedAt[key] ?? null },
      ]),
    )
    return {
      format: SYNC_FORMAT,
      settings,
      guidelines: database.guidelines,
      deletedGuidelines: { ...database.sync.deletedGuidelines },
    }
  },
  /** Takes in a merged snapshot without counting it as a change made here; says which settings and whether guides changed. */
  applySyncSnapshot(snapshot: SyncSnapshot): { settings: SyncedSettingKey[]; guidelines: boolean } {
    const database = load()
    const current = database.settings as unknown as Record<string, unknown>
    const stamped = snapshot.settings as Record<string, { value: unknown; updatedAt: string | null } | undefined>
    const changed: SyncedSettingKey[] = []
    for (const key of SYNCED_SETTING_KEYS) {
      const entry = stamped[key]
      if (entry && !sameValue(current[key], entry.value)) {
        current[key] = entry.value
        changed.push(key)
      }
      if (entry?.updatedAt) {
        database.sync.settingsUpdatedAt[key] = entry.updatedAt
      }
    }
    const guidelines = !sameValue(database.guidelines, snapshot.guidelines)
    database.guidelines = snapshot.guidelines
    database.sync.deletedGuidelines = { ...snapshot.deletedGuidelines }
    save()
    return { settings: changed, guidelines }
  },

  pull(key: string): PullLocalState {
    return load().pulls[key] ?? { drafts: [], viewed: {} }
  },
  updatePull(key: string, update: (pullState: PullLocalState) => void) {
    const { pulls } = load()
    const state = pulls[key] ?? { drafts: [], viewed: {} }
    update(state)
    state.touchedAt = new Date().toISOString()
    pulls[key] = state
    save()
  },

  alerts: () => load().alerts,
  saveAlerts: () => save(),
  commentKinds: (): Readonly<Record<string, CommentKind[]>> => load().commentKinds ?? {},
  /** Adds what newly sorted comments are about. */
  saveCommentKinds(kinds: Record<string, CommentKind[]>) {
    const database = load()
    database.commentKinds = { ...database.commentKinds, ...kinds }
    save()
  },
  seenRelease: (): string | null => load().seenRelease ?? null,
  saveSeenRelease(version: string) {
    load().seenRelease = version
    save()
  },
  usedBefore() {
    load()
    return usedBefore
  },
}
