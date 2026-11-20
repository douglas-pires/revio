import type { AskThread, BriefingRecord } from './claude.types.ts'
import type { EditorInfo, EditorTarget } from './editor.types.ts'
import type { MainEvent } from './event.types.ts'
import type { Guideline, ResolvedGuideline } from './guideline.types.ts'
import type { BlameRange, CommitFile, CommitRef, FileAtCommit, FileHistoryEntry, PullCommit } from './history.types.ts'
import type { Inbox, Stack } from './inbox.types.ts'
import type { MentionsInbox } from './mention.types.ts'
import type { DraftComment, PullDetail, PullLocalState, PullRef, SubmitReviewInput } from './pull.types.ts'
import type { ReactionContent, ReactionSummary } from './reaction.types.ts'
import type { GithubAuthStatus, Settings, SettingsPatch, SyncStatus } from './settings.types.ts'
import type { ThreadComment, ThreadsInbox } from './thread.types.ts'
import type { UpdateStatus } from './update.types.ts'

/** Everything the renderer can ask the main process to do. Exposed as `window.revio`. */
export interface RevioApi {
  getSettings: () => Promise<Settings>
  updateSettings: (patch: SettingsPatch) => Promise<Settings>
  /** Which GitHub token is in use, whose it is and what it may do. */
  githubAuthStatus: () => Promise<GithubAuthStatus>
  /** Verifies the token with GitHub, then stores it encrypted and refreshes the inbox. */
  saveGithubToken: (token: string) => Promise<GithubAuthStatus>
  /** Where syncing settings and guides through iCloud stands. */
  getSyncStatus: () => Promise<SyncStatus>
  /** Syncs with iCloud now, when syncing is on. */
  syncNow: () => Promise<SyncStatus>

  getInbox: () => Promise<Inbox | null>
  /** PRs that mention you or your teams recently (the last fetch, or a fresh one the first time). */
  getMentions: () => Promise<MentionsInbox>
  refreshMentions: () => Promise<MentionsInbox>
  /** Marks the PR's GitHub notification read, clearing its new mentions. */
  markMentionRead: (ref: PullRef) => Promise<void>
  /** Unresolved review threads you are part of; a copy up to `maxAgeMs` old is fine (0 = always fetch). */
  getThreads: (maxAgeMs?: number) => Promise<ThreadsInbox>
  /** Replies in a review thread immediately and returns the posted comment. */
  replyToThread: (threadId: string, body: string) => Promise<ThreadComment>
  setThreadResolved: (threadId: string, resolved: boolean) => Promise<void>
  refreshInbox: () => Promise<Inbox>

  /** PR details; a cached copy up to `maxAgeMs` old is fine (0 = always fetch). */
  getPull: (ref: PullRef, maxAgeMs?: number) => Promise<PullDetail>
  /** The stack this PR belongs to, or null. */
  getStack: (ref: PullRef) => Promise<Stack | null>
  getLocalState: (ref: PullRef) => Promise<PullLocalState>
  saveDrafts: (ref: PullRef, drafts: DraftComment[]) => Promise<void>
  setViewed: (ref: PullRef, path: string, sha: string | null) => Promise<void>
  submitReview: (input: SubmitReviewInput) => Promise<{ url: string }>
  replyToComment: (ref: PullRef, commentId: number, body: string) => Promise<void>
  /** Posts a comment in the PR conversation and returns its link. */
  commentOnPull: (ref: PullRef, body: string) => Promise<{ url: string }>
  /** Adds or removes your reaction on a review comment (by its GraphQL id) and returns its reactions after. */
  setReaction: (ref: PullRef, subjectId: string, content: ReactionContent, on: boolean) => Promise<ReactionSummary[]>

  /** Who last changed each line of a file at a commit. */
  getBlame: (at: FileAtCommit) => Promise<BlameRange[]>
  /** Recent commits that changed a file, up to `at.sha`, flagging this PR's own. */
  getFileHistory: (ref: PullRef, at: FileAtCommit) => Promise<FileHistoryEntry[]>
  /** What a commit changed in a file, as a unified diff, or null when GitHub has none. */
  getCommitFilePatch: (at: FileAtCommit) => Promise<string | null>
  /** The files a commit changed, with their diffs. */
  getCommitFiles: (at: CommitRef) => Promise<CommitFile[]>
  /** The PR's commits, oldest first, as of `headSha`. */
  getPullCommits: (ref: PullRef, headSha: string) => Promise<PullCommit[]>
  /** A file's text at a commit, or null when it is missing, binary or too large. */
  getFileContent: (at: FileAtCommit) => Promise<string | null>

  /** The editors installed on this Mac that Revio can open files in. */
  listEditors: () => Promise<EditorInfo[]>
  /** Opens a file of the PR's repository from your local clone, in your editor. Fails with a reason to show. */
  openInEditor: (target: EditorTarget) => Promise<void>

  listGuidelines: () => Promise<Guideline[]>
  saveGuideline: (g: Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }) => Promise<Guideline>
  deleteGuideline: (id: string) => Promise<void>
  resolveGuidelines: (repo: string, paths: string[]) => Promise<ResolvedGuideline[]>
  knownRepos: () => Promise<string[]>

  generateBriefing: (ref: PullRef) => Promise<BriefingRecord>
  /** Answers the last user message of `thread`. Streams text via `ask-delta` events. */
  askClaude: (ref: PullRef, thread: AskThread) => Promise<{ answer: string }>
  saveAsks: (ref: PullRef, threads: AskThread[]) => Promise<void>

  /** The result of the last update check. */
  getUpdateStatus: () => Promise<UpdateStatus>
  /** Checks GitHub for a newer release now. */
  checkForUpdates: () => Promise<UpdateStatus>

  openExternal: (url: string) => Promise<void>
  onEvent: (listener: (event: MainEvent) => void) => () => void
}

export const IPC = {
  invoke: 'revio:invoke',
  event: 'revio:event',
} as const

export type ApiMethod = Exclude<keyof RevioApi, 'onEvent'>
