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
/** A point a reviewer raised: the first comment of a thread they started. */
export interface RaisedPoint {
  author: string
  /** Written by a bot or an AI reviewer rather than a person. */
  fromBot: boolean
  path: string
  line: number | null
  body: string
  url: string
}
/** One PR you reviewed alongside others: what they raised that you did not, and how your points compared. */
export interface SharedReview {
  repo: string
  number: number
  title: string
  url: string
  /** The other reviewers who left comments. */
  reviewers: string[]
  /** Their points on code you did not comment on nearby. */
  theyRaised: RaisedPoint[]
  /** How many of your points nobody else raised, and how many someone else raised too. */
  onlyYou: number
  both: number
}
/** Claude's grouping of what others raised, as saved: when, and whether bots and AI reviewers were counted. */
export interface SavedCatchThemes {
  createdAt: string
  themes: CatchTheme[]
}
/** A kind of thing other reviewers catch, from Claude's reading of their points. */
export interface CatchTheme {
  name: string
  /** What these points have in common. */
  description: string
  count: number
  /** One check to add to your own reviews. */
  tip: string
}
