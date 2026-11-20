import type { Guideline } from '@shared/guideline.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'
import { z } from 'zod'
import type { ParsedSyncFile, Stamped, StampedSettings, SyncedSettingKey, SyncSnapshot } from './sync.types.ts'

/** A deleted guide is remembered this long, so a Mac that still has it does not bring it back. */
const KEEP_DELETIONS_DAYS = 90

const SETTING_SCHEMAS = {
  pollIntervalMinutes: z.number().positive(),
  staleAfterHours: z.number().positive(),
  staleRepeatHours: z.number().nonnegative(),
  includeTeamRequests: z.boolean(),
  notifyOnRequest: z.boolean(),
  notifyOnReRequest: z.boolean(),
  notifyOnStale: z.boolean(),
  notifyOnMention: z.boolean(),
  ignoreDrafts: z.boolean(),
  claudeBackend: z.enum(['auto', 'api', 'cli']),
  claudeModel: z.string().min(1),
} satisfies Record<SyncedSettingKey, z.ZodType>

const GuidelineSchema = z.object({
  id: z.string().min(1),
  repo: z.string(),
  path: z.string(),
  title: z.string(),
  body: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string(),
})

const FileSchema = z.object({
  format: z.number(),
  settings: z.record(z.string(), z.unknown()).default({}),
  guidelines: z.array(z.unknown()).default([]),
  deletedGuidelines: z.record(z.string(), z.string()).default({}),
})

/** Milliseconds since the epoch; 0 for never or a date that cannot be read. */
function timeOf(iso: string | null | undefined) {
  const t = Date.parse(iso ?? '')
  if (Number.isNaN(t)) {
    return 0
  }
  return t
}

/**
 * The later of two changes. On a tie, including two values never changed, the remote one wins: the sync file is
 * the one place every Mac merges into, so preferring it makes every Mac settle on the same value.
 */
function newer<T>(local: T, remote: T, at: (x: T) => string | null) {
  if (timeOf(at(local)) > timeOf(at(remote))) {
    return local
  }
  return remote
}

function mergeSettings(local: StampedSettings, remote: StampedSettings): StampedSettings {
  const out: Record<string, Stamped<unknown>> = {}
  const l = local as Record<string, Stamped<unknown> | undefined>
  const r = remote as Record<string, Stamped<unknown> | undefined>
  for (const key of SYNCED_SETTING_KEYS) {
    const a = l[key]
    const b = r[key]
    if (a && b) {
      out[key] = newer(a, b, (s) => s.updatedAt)
    } else if (a ?? b) {
      out[key] = (a ?? b) as Stamped<unknown>
    }
  }
  return out as StampedSettings
}

/** Each deletion once, at its latest time, forgetting the ones older than the keep window. */
function mergeDeletions(local: Record<string, string>, remote: Record<string, string>, now: number) {
  const oldest = now - KEEP_DELETIONS_DAYS * MS_PER_DAY
  const out: Record<string, string> = {}
  for (const [id, at] of [...Object.entries(local), ...Object.entries(remote)]) {
    if (timeOf(at) >= oldest && timeOf(at) >= timeOf(out[id])) {
      out[id] = at
    }
  }
  return out
}

/** Every guide from both sides, the latest edit of each, minus the ones deleted after their last edit. */
function mergeGuidelines(local: Guideline[], remote: Guideline[], deleted: Record<string, string>) {
  const byId = new Map<string, Guideline>()
  for (const g of local) {
    byId.set(g.id, g)
  }
  for (const g of remote) {
    const mine = byId.get(g.id)
    if (mine) {
      byId.set(
        g.id,
        newer(mine, g, (x) => x.updatedAt),
      )
    } else {
      byId.set(g.id, g)
    }
  }
  return [...byId.values()].filter((g) => !(g.id in deleted && timeOf(deleted[g.id]) >= timeOf(g.updatedAt)))
}

const sortedEntries = (o: object) => Object.entries(o).sort(([a], [b]) => a.localeCompare(b))

/** The snapshot in one fixed order, so two that hold the same things compare equal. */
function canonical(s: SyncSnapshot) {
  return JSON.stringify([
    sortedEntries(s.settings),
    [...s.guidelines].sort((a, b) => a.id.localeCompare(b.id)).map(sortedEntries),
    sortedEntries(s.deletedGuidelines),
  ])
}

const StampSchema = z.object({ value: z.unknown(), updatedAt: z.string().nullable() })

/** The settings in a sync file that this Revio knows and that hold a valid value; anything else is dropped. */
function parseSettings(raw: Record<string, unknown>): StampedSettings {
  const out: Record<string, Stamped<unknown>> = {}
  for (const key of SYNCED_SETTING_KEYS) {
    const stamp = StampSchema.safeParse(raw[key])
    if (stamp.success && SETTING_SCHEMAS[key].safeParse(stamp.data.value).success) {
      out[key] = { value: stamp.data.value, updatedAt: stamp.data.updatedAt }
    }
  }
  return out as StampedSettings
}

/** The shape of the sync file. A file with a higher number was written by a newer Revio and is left alone. */
export const SYNC_FORMAT = 1
export const SYNCED_SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SyncedSettingKey[]

export const isSyncedSetting = (key: string): key is SyncedSettingKey => Object.hasOwn(SETTING_SCHEMAS, key)

/**
 * Merges this Mac's settings and guides with the synced copy: each setting and each guide keeps its latest change,
 * and a deletion beats any edit made before it.
 */
export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot, now = Date.now()): SyncSnapshot {
  const deletedGuidelines = mergeDeletions(local.deletedGuidelines, remote.deletedGuidelines, now)
  return {
    format: SYNC_FORMAT,
    settings: mergeSettings(local.settings, remote.settings),
    guidelines: mergeGuidelines(local.guidelines, remote.guidelines, deletedGuidelines),
    deletedGuidelines,
  }
}

export const sameSnapshot = (a: SyncSnapshot, b: SyncSnapshot) => canonical(a) === canonical(b)

/** Reads a sync file's JSON, keeping every valid part of it. */
export function parseSyncFile(text: string): ParsedSyncFile {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'The sync file is not valid JSON.', replaceable: true }
  }
  const file = FileSchema.safeParse(json)
  if (!file.success) {
    return { ok: false, error: 'The sync file is not one Revio wrote.', replaceable: true }
  }
  if (file.data.format > SYNC_FORMAT) {
    return {
      ok: false,
      error: 'A newer Revio on another Mac wrote the sync file. Update Revio here to keep syncing.',
      replaceable: false,
    }
  }
  const guidelines = file.data.guidelines.flatMap((g) => {
    const parsed = GuidelineSchema.safeParse(g)
    if (parsed.success) {
      return [parsed.data]
    }
    return []
  })
  return {
    ok: true,
    snapshot: {
      format: SYNC_FORMAT,
      settings: parseSettings(file.data.settings),
      guidelines,
      deletedGuidelines: file.data.deletedGuidelines,
    },
  }
}
