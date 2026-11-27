/** What decides whether a PR can merge, as GitHub reports it. */
export interface MergeStatus {
  isDraft: boolean
  /** Whether the branch merges into its base without conflicts; "UNKNOWN" while GitHub works it out. */
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  /** GitHub's overall verdict: "CLEAN" can merge, "BEHIND" needs the base merged in, "BLOCKED" by rules, … */
  mergeState: string
  /** The combined state of the latest commit's checks, or null when it has none. */
  checks: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED' | null
  /** "APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED", or null when no review is required. */
  reviewDecision: string | null
  changesRequestedBy: string[]
  /** Reviewers asked and not yet answered: logins, and teams as "@slug". */
  pendingReviewers: string[]
  /** Open review threads; null where they are not counted (the inbox, to keep its search light). */
  unresolvedThreads: number | null
}
/** One thing standing between a PR and merging, or the note that nothing does. */
export interface MergeBlocker {
  kind:
    | 'draft'
    | 'conflicts'
    | 'checks-failing'
    | 'checks-running'
    | 'changes-requested'
    | 'awaiting-review'
    | 'unresolved-threads'
    | 'behind'
    | 'blocked'
    | 'ready'
  /** Short, for a chip. */
  label: string
  /** The longer explanation, for a tooltip. */
  detail: string
}
