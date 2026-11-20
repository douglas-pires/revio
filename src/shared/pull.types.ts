import type { AskThread, BriefingRecord } from './claude.types.ts'
import type { ReactionSummary } from './reaction.types.ts'

/** Which pull request: repository ("owner/name") and number. Any object with these fields qualifies. */
export interface PullRef {
  repo: string
  number: number
}
export const pullKey = ({ repo, number }: PullRef) => `${repo}#${number}`
export const isSamePull = (a: PullRef, b: PullRef) => a.repo === b.repo && a.number === b.number
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
  /** Review thread status, keyed by the thread's first comment. Empty if GitHub would not say. */
  threads: PullThreadStatus[]
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
}
