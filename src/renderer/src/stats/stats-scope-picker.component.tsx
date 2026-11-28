import type { StatsScope } from '@shared/stats.types.ts'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
import { TeamPicker } from './team-picker.component.tsx'
import { useScopeChoices } from './use-stats.hook.ts'

const KINDS = [
  { value: 'me', label: 'Me' },
  { value: 'team', label: 'Team' },
  { value: 'repo', label: 'Repository' },
] as const

/** Whose stats: you, teams you are in (one or several), or a repository picked from a list. */
export function StatsScopePicker({ scope, onChange }: { scope: StatsScope; onChange: (scope: StatsScope) => void }) {
  const { teams, repos } = useScopeChoices()
  const pickKind = (kind: StatsScope['kind']) => {
    if (kind === 'me') {
      onChange({ kind: 'me' })
    } else if (kind === 'team' && teams?.teams[0]) {
      onChange({ kind: 'team', teams: [teams.teams[0]] })
    } else if (kind === 'repo' && repos[0]) {
      onChange({ kind: 'repo', repo: repos[0] })
    }
  }
  return (
    <div className="no-drag flex items-center gap-2">
      <SegmentedControl segments={KINDS} value={scope.kind} onChange={pickKind} />
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
      {teams?.error && scope.kind === 'me' && <span className="text-[12px] text-muted">{teams.error}</span>}
    </div>
  )
}
