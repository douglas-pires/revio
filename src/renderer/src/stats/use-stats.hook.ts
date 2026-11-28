import { STATS_PERIODS, type StatsData, type StatsScope, type StatsTeams } from '@shared/stats.types.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { useStoredChoice } from '../common/use-stored-choice.hook.ts'
import { readStoredScope, rememberScope } from './stats-scope-memory.util.ts'

const PERIOD_CHOICES = STATS_PERIODS.map((days) => `${days}` as const)

/** Whose stats are shown, remembered with the teams and repository picked in each tab. */
function useStoredScope() {
  const [scope, setScope] = useState(readStoredScope)
  const change = useCallback((next: StatsScope) => {
    setScope(next)
    rememberScope(next)
  }, [])
  return [scope, change] as const
}

/**
 * The stats for the chosen scope and period. The last ones fetched show at once (even after a restart), then a
 * fresh copy replaces them when they are older than half an hour, or on Refresh.
 */
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
      const isCurrent = () => request === latestRequest.current
      const days = Number(period) as StatsData['days']
      setLoading(true)
      setError(null)
      if (!fresh) {
        globalThis.revio.getSavedStats(scope, days).then((saved) => saved && isCurrent() && setData(saved))
      }
      globalThis.revio
        .getStats(scope, days, fresh)
        .then((next) => isCurrent() && setData(next))
        .catch((failure) => isCurrent() && setError(readErrorMessage(failure)))
        .finally(() => isCurrent() && setLoading(false))
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
