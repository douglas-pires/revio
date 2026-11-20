import type { Mention } from '@shared/mention.types.ts'

const namesYou = (m: Mention) => m.snippets.some((s) => s.viaTeam === null)
const namesTeam = (m: Mention, team: string) => m.snippets.some((s) => s.viaTeam === team)

/** Whose mentions to show: all of them, the ones naming you, or the ones naming one of your teams. */
export type MentionAudience = { kind: 'all' } | { kind: 'me' } | { kind: 'team'; team: string }

export function matchesAudience(m: Mention, a: MentionAudience): boolean {
  if (a.kind === 'me') {
    return namesYou(m)
  }
  if (a.kind === 'team') {
    return namesTeam(m, a.team)
  }
  return true
}

/** The choices with their counts: All, Me, then each team that was mentioned, most mentioned first. */
export function audienceCounts(mentions: readonly Mention[]): { audience: MentionAudience; count: number }[] {
  const teams = [...new Set(mentions.flatMap((m) => m.snippets.flatMap((s) => s.viaTeam ?? [])))]
    .map((team) => ({
      audience: { kind: 'team', team } as const,
      count: mentions.filter((m) => namesTeam(m, team)).length,
    }))
    .sort((a, b) => b.count - a.count)
  return [
    { audience: { kind: 'all' }, count: mentions.length },
    { audience: { kind: 'me' }, count: mentions.filter(namesYou).length },
    ...teams,
  ]
}

export function sameAudience(a: MentionAudience, b: MentionAudience): boolean {
  return a.kind === b.kind && (a.kind !== 'team' || (b.kind === 'team' && a.team === b.team))
}

export function audienceLabel(a: MentionAudience): string {
  if (a.kind === 'team') {
    return `@${a.team}`
  }
  if (a.kind === 'me') {
    return 'Me'
  }
  return 'All'
}
