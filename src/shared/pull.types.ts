import type { AskThread, BriefingRecord } from './claude.types.ts'
import type { FileExplanationRecord } from './explanation.types.ts'
import type { ReactionSummary } from './reaction.types.ts'

/** Which pull request: repository ("owner/name") and number. Any object with these fields qualifies. */
export interface PullRef {
  repo: string
  number: number
}
export const buildPullKey = ({ repo, number }: PullRef) => `${repo}#${number}`
export const isSamePull = (left: PullRef, right: PullRef) => left.repo === right.repo && left.number === right.number
export type DiffSide = 'LEFT' | 'RIGHT'
export interface PullFile {
  path: string
  /** Blob sha; used to reset "viewed" when the file changes. */
  sha: string
  previousPath?: string | undefined
  status: string
  additions: number
  deletions: number
  /** Unified diff hunks; missing for binary or very large files. */
  patch?: string | undefined
}
export interface ReviewComment {
  id: number
  /** GraphQL id, for reacting to the comment. */
  nodeId: string
  inReplyTo?: number | undefined
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
  /** "file" for a comment on the whole file rather than on lines. */
  subjectType: 'line' | 'file'
  reactions: ReactionSummary[]
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
  myReview: {
    state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
    submittedAt: string
    stale: boolean
  } | null
  /** When you last submitted a review of any kind; comments by others after it are new to you. Null before your first. */
  lastReviewedAt: string | null
  isDraft: boolean
  additions: number
  deletions: number
  /** How many commits the PR has. */
  commitCount: number
  files: PullFile[]
  comments: ReviewComment[]
  /** The PR's conversation, oldest first: plain comments and the summaries of submitted reviews. */
  conversation: ConversationComment[]
  /** Review thread status, keyed by the thread's first comment. Empty if GitHub would not say. */
  threads: PullThreadStatus[]
}
/** A comment in the PR's conversation, not on code: a plain comment, or the summary of a submitted review. */
export interface ConversationComment {
  id: string
  kind: 'comment' | 'review'
  author: string
  authorAvatar: string
  body: string
  url: string
  createdAt: string
}
export interface PullThreadStatus {
  id: string
  rootCommentId: number
  resolved: boolean
}
export interface DraftComment {
  id: string
  path: string
  /** Line it comments on, or null for a comment on the whole file. */
  line: number | null
  startLine?: number | undefined
  side: DiffSide
  body: string
  /** Set when the draft is a reply to an existing thread (sent immediately on submit). */
  inReplyTo?: number | undefined
}
export type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'
export interface SubmitReviewInput {
  repo: string
  number: number
  headSha: string
  event: ReviewEvent
  body: string
}
export interface PullLocalState {
  /** Last time anything was saved for this PR; old entries are pruned. */
  touchedAt?: string
  drafts: DraftComment[]
  viewed: Record<string, string>
  briefing?: BriefingRecord
  asks?: AskThread[]
  /** Claude's explanations of files, by path. */
  explanations?: Record<string, FileExplanationRecord>
}
