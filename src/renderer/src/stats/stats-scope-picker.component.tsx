import type { StatsScope, StatsTeams } from '@shared/stats.types.ts'
import { useEffect, useState } from 'react'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
import { readRememberedRepo, readRememberedTeams } from './stats-scope-memory.util.ts'
import { TeamPicker } from './team-picker.component.tsx'
import { useScopeChoices } from './use-stats.hook.ts'

const KINDS = [
  { value: 'me', label: 'Me' },
  { value: 'team', label: 'Team' },
  { value: 'repo', label: 'Repository' },
] as const

/** The scope a tab opens on: the teams or repository picked there last, else the first; null while none is known. */
function pickScopeOf(kind: StatsScope['kind'], teams: StatsTeams | null, repos: string[]): StatsScope | null {
  if (kind === 'me') {
    return { kind: 'me' }
  }
  if (kind === 'team') {
    const remembered = readRememberedTeams(teams?.teams ?? null)
    const picked = remembered.length > 0 ? remembered : teams?.teams.slice(0, 1)
    return picked && picked.length > 0 ? { kind: 'team', teams: picked } : null
  }
  const repo = readRememberedRepo(repos) ?? repos[0]
  return repo ? { kind: 'repo', repo } : null
}

/**
 * Switching tabs, each opening on what was picked in it last. A tab whose list is still loading (your teams, say)
 * waits for it rather than ignoring the click.
 */
function useTabSwitch(onChange: (scope: StatsScope) => void, teams: StatsTeams | null, repos: string[]) {
  const [waitingFor, setWaitingFor] = useState<StatsScope['kind'] | null>(null)
  useEffect(() => {
    const ready = waitingFor && pickScopeOf(waitingFor, teams, repos)
    if (ready) {
      setWaitingFor(null)
      onChange(ready)
    }
  }, [waitingFor, teams, repos, onChange])
  const pickKind = (kind: StatsScope['kind']) => {
    const next = pickScopeOf(kind, teams, repos)
    if (next) {
      onChange(next)
    } else {
      setWaitingFor(kind)
    }
  }
  return { pickKind, waitingFor }
}

/** Why the Team tab is not open yet: your teams are loading, cannot be read, or there are none. */
function describeNoTeams(teams: StatsTeams | null) {
  if (teams === null) {
    return 'Loading your teams…'
  }
  return teams.error ?? 'You are not in any team on GitHub.'
}

/** Whose stats: you, teams you are in (one or several), or a repository picked from a list. */
export function StatsScopePicker({ scope, onChange }: { scope: StatsScope; onChange: (scope: StatsScope) => void }) {
  const { teams, repos } = useScopeChoices()
  const { pickKind, waitingFor } = useTabSwitch(onChange, teams, repos)
  return (
    <div className="no-drag flex items-center gap-2">
      <SegmentedControl segments={KINDS} value={waitingFor ?? scope.kind} onChange={pickKind} />
      {scope.kind === 'team' && teams && (
        <TeamPicker
          teams={teams.teams}
          picked={scope.teams}
          onChange={(picked) => onChange({ kind: 'team', teams: picked })}
        />
      )}
      {scope.kind === 'repo' && (
        <select
          className="input w-56 py-0.5"
          value={scope.repo}
          onChange={(event) => onChange({ kind: 'repo', repo: event.target.value })}
        >
          {repos.map((repo) => (
            <option key={repo} value={repo}>
              {repo}
            </option>
          ))}
        </select>
      )}
      {waitingFor === 'team' && <span className="text-[12px] text-muted">{describeNoTeams(teams)}</span>}
    </div>
  )
}
