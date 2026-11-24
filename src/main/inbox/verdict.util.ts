/** A reviewer's latest verdict as GitHub's GraphQL returns it; no author for a deleted account. */
export interface Verdict {
  author: { login: string } | null
  state: string
}

/** Logins of the reviewers whose latest verdict is `state`, in the order GitHub gives them. */
export function listReviewersByVerdict(
  verdicts: readonly (Verdict | null)[],
  state: 'APPROVED' | 'CHANGES_REQUESTED',
): string[] {
  return verdicts
    .filter((verdict) => verdict !== null)
    .filter((verdict) => verdict.state === state)
    .map((verdict) => verdict.author?.login ?? 'ghost')
}
