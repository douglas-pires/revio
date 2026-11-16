import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Guideline } from '@shared/guideline.types'
import type { PullLocalState } from '@shared/pull.types'
import type { Settings } from '@shared/settings.types'
import type { AlertState } from '../alerts/alerts.util'
import { pruneStalePulls } from '../pulls/pull-state.util'

type StoredSettings = Omit<Settings, 'hasGithubToken' | 'hasAnthropicKey'> & {
  /** Encrypted with the OS keychain via safeStorage, base64. */
  githubTokenEnc?: string
  anthropicKeyEnc?: string
}


interface Db {
  settings: StoredSettings
  guidelines: Guideline[]
  pulls: Record<string, PullLocalState>
  alerts: AlertState
}

const DEFAULT_SETTINGS: StoredSettings = {
  pollIntervalMinutes: 3,
  staleAfterHours: 24,
  staleRepeatHours: 24,
  includeTeamRequests: true,
  notifyOnRequest: true,
  notifyOnStale: true,
  notifyOnMention: true,
  ignoreDrafts: true,
  claudeBackend: 'auto',
  claudeModel: 'claude-opus-5-5',
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
  if (db) return db
  const fresh: Db = {
    settings: { ...DEFAULT_SETTINGS },
    guidelines: DEFAULT_GUIDELINES,
    pulls: {},
    alerts: { requested: {}, staleAlertedAt: {}, seeded: false, mentionsAlerted: {}, mentionsSeeded: false },
  }
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Db>
      db = {
        settings: { ...DEFAULT_SETTINGS, ...raw.settings },
        guidelines: raw.guidelines ?? fresh.guidelines,
        pulls: pruneStalePulls(raw.pulls ?? {}),
        alerts: { ...fresh.alerts, ...raw.alerts },
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
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 150)
}

export function flush() {
  if (!db) return
  mkdirSync(app.getPath('userData'), { recursive: true })
  const tmp = `${file()}.tmp`
  writeFileSync(tmp, JSON.stringify(db, null, 2))
  renameSync(tmp, file())
}

const encrypt = (value: string) =>
  safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(value).toString('base64')
    : `plain:${Buffer.from(value).toString('base64')}`

const decrypt = (value?: string) => {
  if (!value) return undefined
  if (value.startsWith('plain:')) return Buffer.from(value.slice(6), 'base64').toString()
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch {
    return undefined
  }
}

export const store = {
  settings(): Settings {
    const { githubTokenEnc, anthropicKeyEnc, ...rest } = load().settings
    return { ...rest, hasGithubToken: !!githubTokenEnc, hasAnthropicKey: !!anthropicKeyEnc }
  },
  updateSettings(patch: Partial<StoredSettings> & { githubToken?: string | null; anthropicApiKey?: string | null }) {
    const s = load().settings
    const { githubToken, anthropicApiKey, ...rest } = patch
    Object.assign(s, rest)
    if (githubToken !== undefined) s.githubTokenEnc = githubToken ? encrypt(githubToken) : undefined
    if (anthropicApiKey !== undefined) s.anthropicKeyEnc = anthropicApiKey ? encrypt(anthropicApiKey) : undefined
    save()
  },
  githubToken: () => decrypt(load().settings.githubTokenEnc),
  anthropicKey: () => decrypt(load().settings.anthropicKeyEnc),

  guidelines: () => load().guidelines,
  setGuidelines(list: Guideline[]) {
    load().guidelines = list
    save()
  },

  pull(key: string): PullLocalState {
    return load().pulls[key] ?? { drafts: [], viewed: {} }
  },
  updatePull(key: string, fn: (s: PullLocalState) => void) {
    const pulls = load().pulls
    const state = pulls[key] ?? { drafts: [], viewed: {} }
    fn(state)
    state.touchedAt = new Date().toISOString()
    pulls[key] = state
    save()
  },

  alerts: () => load().alerts,
  saveAlerts: () => save(),
}
