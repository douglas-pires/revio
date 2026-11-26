import type { CommentKind } from './comment-kinds.util.ts'

/** A merged PR that followed one you approved, and why it looks like a fix of it. */
export interface FollowUp {
  repo: string
  number: number
  title: string
  url: string
  author: string
  mergedAt: string
  /**
   * Why it counts as a fix of the approved PR: it reverts it, it says it fixes it ("fixes #12", a link after a fix
   * word, or a fix title carrying its number), or it removed or rewrote lines the approved PR added.
   */
  reason: 'reverts' | 'says-fixes' | 'rewrote-lines'
  /** Files both PRs changed. */
  sharedFiles: string[]
  /** How many lines the approved PR added that this one removed or rewrote (0 unless that is the reason). */
  rewrittenLines: number
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
/** The fixes after PRs you approved, and which approved PRs were looked at, to say what the list covers. */
export interface AfterMergeReport {
  pulls: ApprovedPull[]
  /** How many merged PRs you approved were checked, and when the oldest and newest of them merged. */
  examined: number
  from: string | null
  to: string | null
}
/** What a fix after merge teaches about the review that approved the original. */
export interface MissLesson {
  /** What went wrong in the original PR, in a sentence or two. */
  whatWentWrong: string
  /** 'unrelated' when, on reading both, the later PR does not fix anything the approved one did. */
  couldReviewCatch: 'yes' | 'maybe' | 'no' | 'unrelated'
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
  /** When you last reviewed it. */
  reviewedAt: string
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
/** Which reviews the habits are drawn from. */
export interface HabitsFilter {
  /** How many days back, at most the year Revio reads. */
  days: number
  /** '' for every repository, "owner" for one organisation, "owner/name" for one repository. */
  scope: string
}
/** What your past reviews show about how you review. */
export interface ReviewHabits {
  /** The first and last review counted; null when there are none. */
  from: string | null
  to: string | null
  /** Every repository you reviewed in the period, with how many reviews, most first: what the scope can pick. */
  repos: { repo: string; reviews: number }[]
  /** How many repositories the counted reviews are in. */
  repoCount: number
  reviews: number
  pulls: number
  comments: number
  /** PRs you approved, and those you approved without commenting on any line. */
  approvals: number
  silentApprovals: number
  /** The folders you comment in most. */
  topFolders: { folder: string; count: number }[]
  /** How many of your sorted comments are about each kind, most first. */
  kinds: { kind: CommentKind; count: number }[]
  /** Comments sorted by kind so far, of `comments`. */
  sorted: number
  /** Kinds of code concern you seldom comment on; empty until enough comments are sorted to say. */
  rarelyChecked: CommentKind[]
}
