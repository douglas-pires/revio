import type { Mention } from '@shared/mention.types.ts'

const namesYou = (mention: Mention) => mention.snippets.some((snippet) => snippet.viaTeam === null)
const namesTeam = (mention: Mention, team: string) => mention.snippets.some((snippet) => snippet.viaTeam === team)

/** Whose mentions to show: all of them, the ones naming you, or the ones naming one of your teams. */
export type MentionAudience = { kind: 'all' } | { kind: 'me' } | { kind: 'team'; team: string }

export function matchesAudience(mention: Mention, audience: MentionAudience): boolean {
  if (audience.kind === 'me') {
    return namesYou(mention)
  }
  if (audience.kind === 'team') {
    return namesTeam(mention, audience.team)
  }
  return true
}

/** The choices with their counts: All, Me, then each team that was mentioned, most mentioned first. */
export function audienceCounts(mentions: readonly Mention[]): { audience: MentionAudience; count: number }[] {
  const teams = [
    ...new Set(mentions.flatMap((mention) => mention.snippets.flatMap((snippet) => snippet.viaTeam ?? []))),
  ]
    .map((team) => ({
      audience: { kind: 'team', team } as const,
      count: mentions.filter((mention) => namesTeam(mention, team)).length,
    }))
    .sort((left, right) => right.count - left.count)
  return [
    { audience: { kind: 'all' }, count: mentions.length },
    { audience: { kind: 'me' }, count: mentions.filter(namesYou).length },
    ...teams,
  ]
}

export function sameAudience(left: MentionAudience, right: MentionAudience): boolean {
  return left.kind === right.kind && (left.kind !== 'team' || (right.kind === 'team' && left.team === right.team))
}

export function audienceLabel(audience: MentionAudience): string {
  if (audience.kind === 'team') {
    return `@${audience.team}`
  }
  if (audience.kind === 'me') {
    return 'Me'
  }
  return 'All'
}
