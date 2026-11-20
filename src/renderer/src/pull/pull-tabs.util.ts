const LABELS: Record<PullTab, string> = { overview: 'Overview', files: 'Files changed', commits: 'Commits' }

/** Only the Commits tab carries a count. */
function commitCountOf(tab: PullTab, count: number | undefined): number | undefined {
  let shown: number | undefined
  if (tab === 'commits') {
    shown = count
  }
  return shown
}

/** The tabs of a PR's screen. */
export type PullTab = 'overview' | 'files' | 'commits'

/** Overview, Files changed and Commits (with its count, once known). */
export function pullTabs(commitCount: number | undefined) {
  return (['overview', 'files', 'commits'] as const).map((t) => ({
    value: t,
    label: LABELS[t],
    count: commitCountOf(t, commitCount),
  }))
}
