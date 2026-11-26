/** A merged PR that followed one you approved, and why it looks like a fix of it. */
export interface FollowUp {
  repo: string
  number: number
  title: string
  url: string
  author: string
  mergedAt: string
  /** It names the approved PR (a revert, "fixes #12"), or it fixed files the approved PR had just changed. */
  reason: 'mentions' | 'same-files'
  /** Files both PRs changed. */
  sharedFiles: string[]
  /** What Claude learned from it, once asked. */
  lesson: MissLesson | null
  /** Claude is still writing the lesson (asked before you left the screen). */
  lessonPending: boolean
}
/** A PR you approved that later needed fixing. */
export interface ApprovedPull {
  repo: string
  number: number
  title: string
  url: string
  author: string
  approvedAt: string
  mergedAt: string
  followUps: FollowUp[]
}
/** What a fix after merge teaches about the review that approved the original. */
export interface MissLesson {
  /** What went wrong in the original PR, in a sentence or two. */
  whatWentWrong: string
  couldReviewCatch: 'yes' | 'maybe' | 'no'
  /** Where in the original diff the sign was, or why there was none. */
  clue: string
  /** The file the clue is in, or null. */
  path: string | null
  /** One sentence to remember for next time, written as something to check. */
  lesson: string
}
