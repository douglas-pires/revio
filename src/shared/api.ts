import type {
  AskThread,
  BriefingRecord,
  DraftComment,
  GithubAuthStatus,
  Guideline,
  Inbox,
  MainEvent,
  MentionsInbox,
  PullDetail,
  PullLocalState,
  ResolvedGuideline,
  Settings,
  SettingsPatch,
  Stack,
  SubmitReviewInput,
  ThreadComment,
  ThreadsInbox,
} from './types'

/** Everything the renderer can ask the main process to do. Exposed as `window.revio`. */
export interface RevioApi {
  getSettings(): Promise<Settings>
  updateSettings(patch: SettingsPatch): Promise<Settings>
  /** Which GitHub token is in use, whose it is and what it may do. */
  githubAuthStatus(): Promise<GithubAuthStatus>
  /** Verifies the token with GitHub, then stores it encrypted and refreshes the inbox. */
  saveGithubToken(token: string): Promise<GithubAuthStatus>

  getInbox(): Promise<Inbox | null>
  /** PRs that mention you or your teams recently (the last fetch, or a fresh one the first time). */
  getMentions(): Promise<MentionsInbox>
  refreshMentions(): Promise<MentionsInbox>
  /** Marks the PR's GitHub notification read, clearing its new mentions. */
  markMentionRead(repo: string, number: number): Promise<void>
  /** Unresolved review threads you are part of; a copy up to `maxAgeMs` old is fine (0 = always fetch). */
  getThreads(maxAgeMs?: number): Promise<ThreadsInbox>
  /** Replies in a review thread immediately and returns the posted comment. */
  replyToThread(threadId: string, body: string): Promise<ThreadComment>
  setThreadResolved(threadId: string, resolved: boolean): Promise<void>
  refreshInbox(): Promise<Inbox>

  /** PR details; a cached copy up to `maxAgeMs` old is fine (0 = always fetch). */
  getPull(repo: string, number: number, maxAgeMs?: number): Promise<PullDetail>
  /** The stack this PR belongs to, or null. */
  getStack(repo: string, number: number): Promise<Stack | null>
  getLocalState(repo: string, number: number): Promise<PullLocalState>
  saveDrafts(repo: string, number: number, drafts: DraftComment[]): Promise<void>
  setViewed(repo: string, number: number, path: string, sha: string | null): Promise<void>
  submitReview(input: SubmitReviewInput): Promise<{ url: string }>
  replyToComment(repo: string, number: number, commentId: number, body: string): Promise<void>

  listGuidelines(): Promise<Guideline[]>
  saveGuideline(g: Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }): Promise<Guideline>
  deleteGuideline(id: string): Promise<void>
  resolveGuidelines(repo: string, paths: string[]): Promise<ResolvedGuideline[]>
  knownRepos(): Promise<string[]>

  generateBriefing(repo: string, number: number): Promise<BriefingRecord>
  /** Answers the last user message of `thread`. Streams text via `ask-delta` events. */
  askClaude(repo: string, number: number, thread: AskThread): Promise<{ answer: string }>
  saveAsks(repo: string, number: number, threads: AskThread[]): Promise<void>

  openExternal(url: string): Promise<void>
  onEvent(listener: (event: MainEvent) => void): () => void
}

export const IPC = {
  invoke: 'revio:invoke',
  event: 'revio:event',
} as const

export type ApiMethod = Exclude<keyof RevioApi, 'onEvent'>
