import type { AskThread, BriefingRecord, DismissedConcern } from './claude.types.ts'
import type { EditorInfo, EditorTarget } from './editor.types.ts'
import type { Emoji } from './emoji.types.ts'
import type { MainEvent } from './event.types.ts'
import type { FileExplanationRecord } from './explanation.types.ts'
import type { FeedbackInput, FeedbackResult, SystemInfo } from './feedback.types.ts'
import type { CiState, CommitCheck, CommitDetail, LogPage, PullLogQuery } from './git-log.types.ts'
import type { Guideline, ResolvedGuideline } from './guideline.types.ts'
import type { BlameRange, CommitFile, CommitRef, FileAtCommit, FileHistoryEntry, PullCommit } from './history.types.ts'
import type { Inbox, Stack, StackPrComments } from './inbox.types.ts'
import type { MentionsInbox } from './mention.types.ts'
import type { Mentionable } from './mentionable.types.ts'
import type { DraftComment, PullDetail, PullLocalState, PullRef, SinceReview, SubmitReviewInput } from './pull.types.ts'
import type { ReactionContent, ReactionSummary } from './reaction.types.ts'
import type { GuideEntry, SimilarComment } from './review-history.types.ts'
import type { GithubAuthStatus, Settings, SettingsPatch, SyncStatus } from './settings.types.ts'
import type { SymbolSearch } from './symbol.types.ts'
import type { ThreadComment, ThreadsInbox } from './thread.types.ts'
import type { UpdateStatus } from './update.types.ts'
import type { ReleaseNotes, UnseenUpdate } from './whats-new.types.ts'

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
  /** What changed since your last review of the PR, or null when you have not reviewed it. */
  getChangesSinceReview: (ref: PullRef) => Promise<SinceReview | null>
  /** The stack this PR belongs to, or null. */
  getStack: (ref: PullRef) => Promise<Stack | null>
  /** Where you commented across a stack's PRs. Empty when GitHub would not say. */
  getStackComments: (stack: Stack) => Promise<StackPrComments[]>
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
  /** Where a name is defined and used, in the PR's files and elsewhere in the repository, read at the PR's head. */
  findSymbol: (ref: PullRef, name: string) => Promise<SymbolSearch>
  /** A file's text at a commit, or null when it is missing, binary or too large. */
  getFileContent: (at: FileAtCommit) => Promise<string | null>

  /** The editors installed on this Mac that Revio can open files in. */
  listEditors: () => Promise<EditorInfo[]>
  /** Opens a file of the PR's repository from your local clone, in your editor. Fails with a reason to show. */
  openInEditor: (target: EditorTarget) => Promise<void>

  listGuidelines: () => Promise<Guideline[]>
  saveGuideline: (guideline: Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }) => Promise<Guideline>
  deleteGuideline: (id: string) => Promise<void>
  resolveGuidelines: (repo: string, paths: string[]) => Promise<ResolvedGuideline[]>
  knownRepos: () => Promise<string[]>
  /** Adds a line to the guide for a repository and folder, starting that guide when there is none. */
  addGuideEntry: (entry: GuideEntry) => Promise<Guideline>
  /** Comments you sent in past reviews that read like `body`, most alike first. */
  findSimilarComments: (body: string) => Promise<SimilarComment[]>

  generateBriefing: (ref: PullRef) => Promise<BriefingRecord>
  /** Answers the last user message of `thread`. Streams text via `ask-delta` events. */
  askClaude: (ref: PullRef, thread: AskThread) => Promise<{ answer: string }>
  saveAsks: (ref: PullRef, threads: AskThread[]) => Promise<void>
  /** The briefing concerns you marked as not an issue on the PR, kept out of later briefings. */
  saveDismissedConcerns: (ref: PullRef, dismissed: DismissedConcern[]) => Promise<void>
  /** Claude explains a file of the PR for a reviewer new to that code, and keeps the explanation. */
  explainFile: (ref: PullRef, path: string) => Promise<FileExplanationRecord>
  /** The PR's files in code you have not reviewed before; none when you never reviewed in the repository. */
  listUnfamiliarFiles: (ref: PullRef) => Promise<string[]>

  /** The result of the last update check. */
  getUpdateStatus: () => Promise<UpdateStatus>
  /** Checks GitHub for a newer release now. */
  checkForUpdates: () => Promise<UpdateStatus>
  /** Downloads the available update, reporting in the update status. */
  downloadUpdate: () => Promise<void>
  /** Quits, replaces Revio with the downloaded update and opens it again. */
  restartToUpdate: () => Promise<void>

  /** Shows a sample notification; false when macOS refused it (notifications off for Revio). */
  testNotification: () => Promise<boolean>
  /** A page of a PR's git log, from GitHub. */
  getPullLog: (repo: string, query: PullLogQuery) => Promise<LogPage>
  /** A commit's message, author and changed files, from GitHub. */
  getCommitDetail: (repo: string, hash: string) => Promise<CommitDetail>
  /** CI state on GitHub per commit hash. */
  getCommitCi: (repo: string, hashes: string[]) => Promise<Record<string, CiState>>
  /** Each GitHub check on a commit, failing first. */
  getCommitChecks: (repo: string, hash: string) => Promise<CommitCheck[]>

  /** Basic facts about this Mac and this Revio, shown before a bug report includes them. */
  getSystemInfo: () => Promise<SystemInfo>
  /** "owner/name" of the repository feedback goes to, or null when this build does not know it. */
  getFeedbackRepo: () => Promise<string | null>
  /** Opens an issue for a bug report or feature request, or its prefilled form in the browser when that fails. */
  submitFeedback: (input: FeedbackInput) => Promise<FeedbackResult>

  /** The update installed since you last used Revio, or null. */
  getUnseenUpdate: () => Promise<UnseenUpdate | null>
  /** Remembers the running release as seen. */
  markUpdateSeen: () => Promise<void>
  /** What the latest releases brought, newest first. */
  listReleaseNotes: () => Promise<ReleaseNotes[]>

  /** GitHub's emojis, for writing comments. */
  listEmojis: () => Promise<Emoji[]>

  /** Who can be mentioned in a repository. */
  listMentionables: (repo: string) => Promise<Mentionable[]>

  openExternal: (url: string) => Promise<void>
  onEvent: (listener: (event: MainEvent) => void) => () => void
}

export const IPC = {
  invoke: 'revio:invoke',
  event: 'revio:event',
} as const

export type ApiMethod = Exclude<keyof RevioApi, 'onEvent'>
