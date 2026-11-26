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
