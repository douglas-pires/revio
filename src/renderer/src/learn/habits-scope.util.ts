import type { ReviewHabits } from '@shared/learn.types.ts'

/** The longest folder shown whole; longer ones keep their start and end. */
const MAX_FOLDER_CHARS = 48
const KEPT_END_SEGMENTS = 2

/** A choice in the scope menu: every repository, an organisation, or a repository. */
export interface ScopeOption {
  value: string
  label: string
}

/** Every repository, then each organisation with all its repositories, then each repository, by reviews. */
export function buildScopeOptions(repos: ReviewHabits['repos']): ScopeOption[] {
  const owners = new Map<string, number>()
  for (const { repo, reviews } of repos) {
    const owner = repo.split('/')[0] ?? repo
    owners.set(owner, (owners.get(owner) ?? 0) + reviews)
  }
  return [
    { value: '', label: 'All repositories' },
    ...[...owners]
      .sort((left, right) => right[1] - left[1])
      .map(([owner, reviews]) => ({ value: owner, label: `${owner} (organisation, ${reviews})` })),
    ...repos.map(({ repo, reviews }) => ({ value: repo, label: `${repo} (${reviews})` })),
  ]
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** What the numbers are drawn from: how many reviews, between which days, in how many repositories. */
export function describeCoverage(habits: ReviewHabits) {
  if (!(habits.from && habits.to)) {
    return 'No reviews in this period.'
  }
  let repositories = `${habits.repoCount} repositories`
  if (habits.repoCount === 1) {
    repositories = 'one repository'
  }
  return `From ${habits.reviews} reviews you sent between ${formatDay(habits.from)} and ${formatDay(habits.to)}, in ${repositories}.`
}

/**
 * A folder as listed: without the repository when one is picked, and when long, its first two parts and its last
 * ones around "…", so both where it is and what it is stay readable.
 */
export function shortenFolder(folder: string, scope: string) {
  let shown = folder
  if (scope.includes('/') && folder.toLowerCase().startsWith(`${scope.toLowerCase()}/`)) {
    shown = folder.slice(scope.length + 1) || '(top level)'
  }
  if (shown.length <= MAX_FOLDER_CHARS) {
    return shown
  }
  const parts = shown.split('/')
  return [...parts.slice(0, 2), '…', ...parts.slice(-KEPT_END_SEGMENTS)].join('/')
}
