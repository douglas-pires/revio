import type { Guideline } from '@shared/guideline.types.ts'
import type { Settings } from '@shared/settings.types.ts'

/**
 * The settings that follow you between Macs. Secrets stay in this Mac's keychain, and the editor and code folders
 * describe this Mac's disk, so none of those sync.
 */
export type SyncedSettingKey = Extract<
  keyof Settings,
  | 'pollIntervalMinutes'
  | 'staleAfterHours'
  | 'staleRepeatHours'
  | 'includeTeamRequests'
  | 'notifyOnRequest'
  | 'notifyOnReRequest'
  | 'notifyOnStale'
  | 'notifyOnMention'
  | 'ignoreDrafts'
  | 'claudeBackend'
  | 'claudeModel'
>

/** A value and when it was last changed; null when it was never changed on that Mac. */
export interface Stamped<T> {
  value: T
  updatedAt: string | null
}

export type StampedSettings = { [K in SyncedSettingKey]?: Stamped<Settings[K]> }

export interface SyncSnapshot {
  format: number
  settings: StampedSettings
  guidelines: Guideline[]
  /** Guide id → when it was deleted. */
  deletedGuidelines: Record<string, string>
}

/** A sync file read: its snapshot, or why not and whether it may be replaced (not when a newer Revio wrote it). */
export type ParsedSyncFile = { ok: true; snapshot: SyncSnapshot } | { ok: false; error: string; replaceable: boolean }
