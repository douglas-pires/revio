import type { AskThread, BriefingRecord } from './claude.types'
import type { MainEvent } from './event.types'
import type { Guideline, ResolvedGuideline } from './guideline.types'
import type { Inbox, Stack } from './inbox.types'
import type { MentionsInbox } from './mention.types'
import type { DraftComment, PullDetail, PullLocalState, PullRef, SubmitReviewInput } from './pull.types'
import type { GithubAuthStatus, Settings, SettingsPatch } from './settings.types'
import type { ThreadComment, ThreadsInbox } from './thread.types'

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
  markMentionRead(ref: PullRef): Promise<void>
  /** Unresolved review threads you are part of; a copy up to `maxAgeMs` old is fine (0 = always fetch). */
  getThreads(maxAgeMs?: number): Promise<ThreadsInbox>
  /** Replies in a review thread immediately and returns the posted comment. */
  replyToThread(threadId: string, body: string): Promise<ThreadComment>
  setThreadResolved(threadId: string, resolved: boolean): Promise<void>
  refreshInbox(): Promise<Inbox>

  /** PR details; a cached copy up to `maxAgeMs` old is fine (0 = always fetch). */
  getPull(ref: PullRef, maxAgeMs?: number): Promise<PullDetail>
  /** The stack this PR belongs to, or null. */
  getStack(ref: PullRef): Promise<Stack | null>
  getLocalState(ref: PullRef): Promise<PullLocalState>
  saveDrafts(ref: PullRef, drafts: DraftComment[]): Promise<void>
  setViewed(ref: PullRef, path: string, sha: string | null): Promise<void>
  submitReview(input: SubmitReviewInput): Promise<{ url: string }>
  replyToComment(ref: PullRef, commentId: number, body: string): Promise<void>

  listGuidelines(): Promise<Guideline[]>
  saveGuideline(g: Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }): Promise<Guideline>
  deleteGuideline(id: string): Promise<void>
  resolveGuidelines(repo: string, paths: string[]): Promise<ResolvedGuideline[]>
  knownRepos(): Promise<string[]>

  generateBriefing(ref: PullRef): Promise<BriefingRecord>
  /** Answers the last user message of `thread`. Streams text via `ask-delta` events. */
  askClaude(ref: PullRef, thread: AskThread): Promise<{ answer: string }>
  saveAsks(ref: PullRef, threads: AskThread[]): Promise<void>

  openExternal(url: string): Promise<void>
  onEvent(listener: (event: MainEvent) => void): () => void
}

export const IPC = {
  invoke: 'revio:invoke',
  event: 'revio:event',
} as const

export type ApiMethod = Exclude<keyof RevioApi, 'onEvent'>
