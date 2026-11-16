export type ClaudeBackend = 'auto' | 'api' | 'cli'
export interface Settings {
  /** Poll GitHub every N minutes. */
  pollIntervalMinutes: number
  /** A requested review becomes "stale" after this many hours without a review from you. */
  staleAfterHours: number
  /** Repeat the stale alert every N hours while it stays stale (0 = alert once). */
  staleRepeatHours: number
  /** Count team review requests, not only requests addressed to you directly. */
  includeTeamRequests: boolean
  notifyOnRequest: boolean
  notifyOnStale: boolean
  notifyOnMention: boolean
  /** Skip draft PRs in the inbox and alerts. */
  ignoreDrafts: boolean
  claudeBackend: ClaudeBackend
  claudeModel: string
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
