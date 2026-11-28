import type { ShortcutOverrides } from './shortcut-actions.util.ts'

type ClaudeBackend = 'auto' | 'api' | 'cli'
/** The left rail during a review block: without its counts, hidden, or as usual. */
export type FocusRail = 'quiet' | 'hidden' | 'shown'
export interface Settings {
  /** Poll GitHub every N minutes. */
  pollIntervalMinutes: number
  /** A requested review becomes "stale" after this many hours without a review from you. */
  staleAfterHours: number
  /** Repeat the stale alert every N hours while it stays stale (0 = alert once). */
  staleRepeatHours: number
  /** Count team review requests, not only requests addressed to you directly. */
  includeTeamRequests: boolean
  /** A new review request. */
  notifyOnRequest: boolean
  /** A review requested again on a PR you already reviewed. */
  notifyOnReRequest: boolean
  notifyOnStale: boolean
  notifyOnMention: boolean
  /** Skip draft PRs in the inbox and alerts. */
  ignoreDrafts: boolean
  claudeBackend: ClaudeBackend
  claudeModel: string
  /** Editor id to open files in ("" = the first one installed). */
  editor: string
  /** Your own keys for shortcuts, by action; an action left out has its default. */
  shortcuts: ShortcutOverrides
  /** Extra folders to look for local clones in, besides your home folder. */
  codeFolders: string[]
  /** What the left rail shows during a review block. */
  focusRail: FocusRail
  /** The Shortcuts app shortcut that turns Do Not Disturb on when a block starts ("" = leave it alone). */
  dndOnShortcut: string
  /** The shortcut that turns it off again when the block ends or pauses. */
  dndOffShortcut: string
  /** Sync the synced settings and the review guides with your other Macs through iCloud Drive. */
  syncViaIcloud: boolean
  /** Secrets are never sent back to the renderer, only whether they are set. */
  hasGithubToken: boolean
  hasAnthropicKey: boolean
}
/** Where the GitHub token in use comes from. */
export type GithubTokenSource = 'settings' | 'dotenv' | 'GH_TOKEN' | 'GITHUB_TOKEN' | 'gh-cli' | 'none'
export interface GithubAuthStatus {
  source: GithubTokenSource
  login: string | null
  /** Classic token scopes; null for fine-grained tokens, whose permissions GitHub does not report. */
  scopes: string[] | null
  /** Whether the token can read team names (read:org). Null when unknown. */
  canSeeTeams: boolean | null
  error?: string
}
export interface SettingsPatch extends Partial<Omit<Settings, 'hasGithubToken' | 'hasAnthropicKey'>> {
  /** null clears the stored token. */
  githubToken?: string | null
  anthropicApiKey?: string | null
}
/** Where syncing through iCloud stands on this Mac. */
export interface SyncStatus {
  state: 'off' | 'synced' | 'downloading' | 'unavailable' | 'error'
  /** When this Mac last read and wrote the synced copy. */
  lastSyncedAt: string | null
  /** Why syncing is unavailable or failed. */
  message: string | null
}
