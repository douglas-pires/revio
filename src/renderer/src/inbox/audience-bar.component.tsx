import type { PullSummary } from '@shared/inbox.types.ts'
import { memo } from 'react'
import { cx } from '../common/format.util.ts'
import { countTeams, type ReviewAudience } from './inbox-query.util.ts'

/** "team" stands in for team names the token may not read (no read:org). */
function teamTitle(team: string) {
  if (team === 'team') {
    return 'Requested from a team (grant read:org to see team names)'
  }
  return `Requested from @${team}`
}

/** All / Me / per-team buttons, like GitHub's review filter menu. They rewrite the search query. */
export const AudienceBar = memo(function AudienceBarView({
  requested,
  active,
  onPick,
}: {
  requested: readonly PullSummary[]
  active: ReviewAudience | null
  onPick: (audience: ReviewAudience) => void
}) {
  const teams = countTeams(requested)
  const direct = requested.filter((p) => !p.viaTeam).length
  const isActive = (a: ReviewAudience) =>
    active?.kind === a.kind && (a.kind !== 'team' || (active.kind === 'team' && active.team === a.team))
  const options: { audience: ReviewAudience; label: string; count: number; title: string }[] = [
    { audience: { kind: 'all' }, label: 'All', count: requested.length, title: 'Everything in your inbox' },
    { audience: { kind: 'me' }, label: 'Me', count: direct, title: 'Requested from you directly' },
    ...teams.map(([team, count]) => ({
      audience: { kind: 'team', team } as const,
      label: `@${team}`,
      count,
      title: teamTitle(team),
    })),
  ]
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
      <span className="mr-1 text-muted">Requested from</span>
      {options.map(({ audience, label, count, title }) => (
        <button
          type="button"
          key={label}
          title={title}
          onClick={() => onPick(audience)}
          className={cx(
            'rounded-full border px-2.5 py-0.5 whitespace-nowrap',
            isActive(audience) && 'border-accent bg-accent/15 text-accent',
            !isActive(audience) && 'border-line text-muted hover:text-fg',
          )}
        >
          {label} <span className="font-mono text-[11px] opacity-80">{count}</span>
        </button>
      ))}
    </div>
  )
})
