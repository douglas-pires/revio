import type { Mention } from '@shared/mention.types.ts'

const mentionsYou = (mention: Mention) => mention.snippets.some((snippet) => snippet.viaTeam === null)
const mentionsTeam = (mention: Mention, team: string) => mention.snippets.some((snippet) => snippet.viaTeam === team)

/** Whose mentions to show: all of them, the ones naming you, or the ones naming one of your teams. */
export type MentionAudience = { kind: 'all' } | { kind: 'me' } | { kind: 'team'; team: string }

export function matchesAudience(mention: Mention, audience: MentionAudience): boolean {
  if (audience.kind === 'me') {
    return mentionsYou(mention)
  }
  if (audience.kind === 'team') {
    return mentionsTeam(mention, audience.team)
  }
  return true
}

/** The choices with their counts: All, Me, then each team that was mentioned, most mentioned first. */
export function countAudiences(mentions: readonly Mention[]): { audience: MentionAudience; count: number }[] {
  const teams = [
    ...new Set(mentions.flatMap((mention) => mention.snippets.flatMap((snippet) => snippet.viaTeam ?? []))),
  ]
    .map((team) => ({
      audience: { kind: 'team', team } as const,
      count: mentions.filter((mention) => mentionsTeam(mention, team)).length,
    }))
    .sort((left, right) => right.count - left.count)
  return [
    { audience: { kind: 'all' }, count: mentions.length },
    { audience: { kind: 'me' }, count: mentions.filter(mentionsYou).length },
    ...teams,
  ]
}

export function sameAudience(left: MentionAudience, right: MentionAudience): boolean {
  return left.kind === right.kind && (left.kind !== 'team' || (right.kind === 'team' && left.team === right.team))
}

export function describeAudience(audience: MentionAudience): string {
  if (audience.kind === 'team') {
    return `@${audience.team}`
  }
  if (audience.kind === 'me') {
    return 'Me'
  }
  return 'All'
}
