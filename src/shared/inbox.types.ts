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
  /** When you last reviewed this PR, if ever: a request after it is a re-request. */
  yourLastReviewAt: string | null
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
/** Your part in one stacked PR's review threads, for marking the stack bar. */
export interface StackPrComments {
  repo: string
  number: number
  /** Threads you commented in. */
  yourThreads: number
  /** Of those, open ones where someone replied after you: waiting on your answer. */
  awaitingYou: number
}
