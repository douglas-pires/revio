// Types shared by the main process, the preload bridge and the renderer.

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
  /** Skip draft PRs in the inbox and alerts. */
  ignoreDrafts: boolean
  claudeBackend: ClaudeBackend
  claudeModel: string
  /** Secrets are never sent back to the renderer, only whether they are set. */
  hasGithubToken: boolean
  hasAnthropicKey: boolean
}

export interface SettingsPatch extends Partial<Omit<Settings, 'hasGithubToken' | 'hasAnthropicKey'>> {
  /** null clears the stored token. */
  githubToken?: string | null
  anthropicApiKey?: string | null
}

export interface Guideline {
  id: string
  /** "owner/repo", or "*" for guidelines that apply to every repository. */
  repo: string
  /** Folder inside the repo, e.g. "apps/web/". Empty string = whole repo. */
  path: string
  title: string
  body: string
  enabled: boolean
  updatedAt: string
}

export interface PullSummary {
  id: string
  number: number
  title: string
  url: string
  repo: string
  author: string
  authorAvatar: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  /** When your review was (most recently) requested. */
  requestedAt: string | null
  /** Whether the request is addressed to a team you are in rather than to you. */
  viaTeam: string | null
  additions: number
  deletions: number
  changedFiles: number
  headRef: string
  baseRef: string
  reviewDecision: string | null
  /** Repository default branch, to tell stacked PRs apart. */
  defaultBranch: string
  /** Set when this PR is part of a stack: 1-based position from the bottom. */
  stack?: { id: string; position: number; size: number }
  stale: boolean
  /** Hours since the request (or since creation when unknown). */
  waitingHours: number
}

/** A PR inside a stack. Stack members can be outside your inbox (not requested from you). */
export interface StackPr {
  id: string
  number: number
  title: string
  url: string
  repo: string
  author: string
  authorAvatar: string
  headRef: string
  baseRef: string
  isDraft: boolean
  reviewDecision: string | null
  /** Where it sits in your inbox, if anywhere. */
  inbox: 'requested' | 'reviewed' | null
  stale: boolean
}

/**
 * PRs chained by branches: a PR whose base branch is another open PR's head branch sits on top of it.
 * `nodes` is in depth-first order from the bottom (closest to the default branch), so it reads as review order.
 */
export interface Stack {
  id: string
  repo: string
  /** The branch the bottom PR targets, usually the default branch. */
  base: string
  nodes: { pr: StackPr; depth: number }[]
}

export interface Inbox {
  viewer: string
  requested: PullSummary[]
  reviewed: PullSummary[]
  stacks: Stack[]
  fetchedAt: string
  error?: string
}

export type DiffSide = 'LEFT' | 'RIGHT'

export interface PullFile {
  path: string
  /** Blob sha; used to reset "viewed" when the file changes. */
  sha: string
  previousPath?: string
  status: string
  additions: number
  deletions: number
  /** Unified diff hunks; missing for binary or very large files. */
  patch?: string
}

export interface ReviewComment {
  id: number
  inReplyTo?: number
  path: string
  line: number | null
  startLine: number | null
  side: DiffSide
  body: string
  author: string
  authorAvatar: string
  createdAt: string
  url: string
  outdated: boolean
}

export interface PullDetail {
  /** When this copy was fetched from GitHub (ISO). */
  fetchedAt: string
  repo: string
  number: number
  title: string
  body: string
  url: string
  author: string
  authorAvatar: string
  headRef: string
  baseRef: string
  headSha: string
  baseSha: string
  /** Your GitHub login. */
  viewer: string
  /** Your most recent decisive review (approve / request changes), else your latest comment review. */
  myReview: { state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'; submittedAt: string; stale: boolean } | null
  isDraft: boolean
  additions: number
  deletions: number
  files: PullFile[]
  comments: ReviewComment[]
}

export interface DraftComment {
  id: string
  path: string
  line: number
  startLine?: number
  side: DiffSide
  body: string
  /** Set when the draft is a reply to an existing thread (sent immediately on submit). */
  inReplyTo?: number
}

export type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'

export interface SubmitReviewInput {
  repo: string
  number: number
  headSha: string
  event: ReviewEvent
  body: string
}

export interface FocusItem {
  path: string
  lines: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface Briefing {
  gist: string
  intent: string
  risk: 'low' | 'medium' | 'high'
  focus: FocusItem[]
  ignore: { path: string; reason: string }[]
  concerns: { title: string; detail: string; path: string; line: number | null }[]
  questions: string[]
  guidelineChecks: { guideline: string; status: 'ok' | 'concern' | 'unclear'; note: string }[]
}

export interface BriefingRecord {
  headSha: string
  createdAt: string
  backend: 'api' | 'cli'
  model: string
  briefing: Briefing
  /** Files whose diff was not sent to Claude (binary, or over the size budget). */
  omittedFiles: string[]
}

export interface ResolvedGuideline extends Guideline {
  /** Changed files this guideline covers. */
  matchedFiles: number
}

export interface AskMessage {
  role: 'user' | 'assistant'
  content: string
}

/** A conversation with Claude about a selected range of the diff. */
export interface AskThread {
  id: string
  path: string
  side: DiffSide
  startLine: number
  endLine: number
  /** The selected diff lines, with +/- markers, as shown to the reviewer. */
  snippet: string
  messages: AskMessage[]
  createdAt: string
}

export interface PullLocalState {
  /** Last time anything was saved for this PR; old entries are pruned. */
  touchedAt?: string
  drafts: DraftComment[]
  viewed: Record<string, string>
  briefing?: BriefingRecord
  asks?: AskThread[]
}

export type MainEvent =
  | { type: 'inbox'; inbox: Inbox }
  | { type: 'open-pull'; repo: string; number: number }
  | { type: 'briefing-progress'; key: string; message: string }
  | { type: 'ask-delta'; threadId: string; text: string }

export const pullKey = (repo: string, number: number) => `${repo}#${number}`
