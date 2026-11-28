import { STATS_PERIODS, type StatsData, type StatsScope, type StatsTeams } from '@shared/stats.types.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { useStoredChoice } from '../common/use-stored-choice.hook.ts'

const SCOPE_KEY = 'revio.statsScope'
const PERIOD_CHOICES = STATS_PERIODS.map((days) => `${days}` as const)

function readStoredScope(): StatsScope {
  try {
    const stored = JSON.parse(localStorage.getItem(SCOPE_KEY) ?? 'null') as StatsScope | null
    // A team scope from before several teams could be picked has no list: start again with your own.
    if ((stored?.kind === 'team' && Array.isArray(stored.teams)) || stored?.kind === 'repo' || stored?.kind === 'me') {
      return stored
    }
  } catch {
    /* unreadable: start with your own stats */
  }
  return { kind: 'me' }
}

/** Whose stats are shown, remembered on this Mac (a convenience: storage failures are ignored). */
function useStoredScope() {
  const [scope, setScope] = useState(readStoredScope)
  const change = useCallback((next: StatsScope) => {
    setScope(next)
    try {
      localStorage.setItem(SCOPE_KEY, JSON.stringify(next))
    } catch {
      /* keep the in-memory choice */
    }
  }, [])
  return [scope, change] as const
}

/** The stats for the chosen scope and period: loading them, and loading them again fresh. */
export function useStats() {
  const [scope, setScope] = useStoredScope()
  const [period, setPeriod] = useStoredChoice('revio.statsPeriod', PERIOD_CHOICES, '90')
  const [data, setData] = useState<StatsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const latestRequest = useRef(0)
  const load = useCallback(
    (fresh: boolean) => {
      const request = ++latestRequest.current
      setLoading(true)
      setError(null)
      globalThis.revio
        .getStats(scope, Number(period) as StatsData['days'], fresh)
        .then((next) => request === latestRequest.current && setData(next))
        .catch((failure) => request === latestRequest.current && setError(readErrorMessage(failure)))
        .finally(() => request === latestRequest.current && setLoading(false))
    },
    [scope, period],
  )
  useEffect(() => load(false), [load])
  return { scope, setScope, period, setPeriod, data, error, loading, refresh: () => load(true) }
}

/** The teams and repositories you can pick; teams are null while they load. */
export function useScopeChoices() {
  const [teams, setTeams] = useState<StatsTeams | null>(null)
  const [repos, setRepos] = useState<string[]>([])
  useEffect(() => {
    globalThis.revio.listStatsTeams().then(setTeams)
    globalThis.revio.knownRepos().then(setRepos)
  }, [])
  return { teams, repos }
}

export type StatsState = ReturnType<typeof useStats>
