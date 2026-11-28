import type { StatsData, StatsScope, StatsTeam } from '@shared/stats.types.ts'

const SCOPE_KEY = 'revio.statsScope'
const TEAMS_KEY = 'revio.statsTeams'
const REPO_KEY = 'revio.statsRepo'

/** Reads a stored JSON value (a convenience: storage failures read as none). */
function readStored<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
  } catch {
    return null
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode or blocked storage: the choice lasts until the window closes */
  }
}

/** The scope last shown; your own stats the first time. */
export function readStoredScope(): StatsScope {
  const stored = readStored<StatsScope>(SCOPE_KEY)
  // A team scope from before several teams could be picked has no list: start again with your own.
  if ((stored?.kind === 'team' && Array.isArray(stored.teams)) || stored?.kind === 'repo' || stored?.kind === 'me') {
    return stored
  }
  return { kind: 'me' }
}

/** Remembers the scope, and the teams or repository in it, so each tab comes back as you left it. */
export function rememberScope(scope: StatsScope) {
  store(SCOPE_KEY, scope)
  if (scope.kind === 'team') {
    store(TEAMS_KEY, scope.teams)
  }
  if (scope.kind === 'repo') {
    store(REPO_KEY, scope.repo)
  }
}

/** The teams last picked, kept to those you are still in (all of them while that list loads); none at first. */
export function readRememberedTeams(available: StatsTeam[] | null) {
  const remembered = readStored<StatsTeam[]>(TEAMS_KEY) ?? []
  if (available === null) {
    return remembered
  }
  return remembered.filter((team) =>
    available.some((candidate) => candidate.org === team.org && candidate.slug === team.slug),
  )
}

/** The repository last picked, when it is still one Revio knows; null otherwise. */
export function readRememberedRepo(available: string[]) {
  const remembered = readStored<string>(REPO_KEY)
  return remembered !== null && available.includes(remembered) ? remembered : null
}

/** Whether loaded stats are the ones for this scope and period (the same teams in any order). */
export function isStatsFor(data: StatsData, scope: StatsScope, period: string) {
  return `${data.days}` === period && describeScopeKey(data.scope) === describeScopeKey(scope)
}

function describeScopeKey(scope: StatsScope) {
  if (scope.kind === 'team') {
    return `team:${scope.teams
      .map((team) => `${team.org}/${team.slug}`)
      .sort()
      .join(',')}`
  }
  if (scope.kind === 'repo') {
    return `repo:${scope.repo}`
  }
  return 'me'
}
