import type { PullSummary } from '@shared/inbox.types.ts'
import { memo } from 'react'
import { FilterChips } from '../common/filter-chips.component.tsx'
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
  const direct = requested.filter((pull) => !pull.viaTeam).length
  const isActive = (audience: ReviewAudience) =>
    active?.kind === audience.kind &&
    (audience.kind !== 'team' || (active.kind === 'team' && active.team === audience.team))
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
  const chips = options.map(({ audience, label, count, title }) => ({
    key: label,
    label,
    count,
    title,
    active: isActive(audience),
    onPick: () => onPick(audience),
  }))
  return <FilterChips label="Requested from" chips={chips} />
})
