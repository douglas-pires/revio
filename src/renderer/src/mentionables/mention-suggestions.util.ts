import type { Mentionable } from '@shared/mentionable.types.ts'
import { rankFuzzyMatches } from '../common/fuzzy-match.util.ts'

/** People and teams suggested at once. */
const SUGGESTION_LIMIT = 8

/** Those in the PR first, then everyone else, as they came. */
function putParticipantsFirst(mentionables: readonly Mentionable[], participants: ReadonlySet<string>) {
  const isParticipant = ({ handle }: Mentionable) => participants.has(handle)
  return [...mentionables.filter(isParticipant), ...mentionables.filter((mentionable) => !isParticipant(mentionable))]
}

/** Who matches what follows "@", by login or name, best first; among equals, those in the PR first. */
export function suggestMentionables(
  mentionables: readonly Mentionable[],
  participants: ReadonlySet<string>,
  query: string,
): Mentionable[] {
  const candidates = putParticipantsFirst(mentionables, participants)
  const readText = ({ handle, name }: Mentionable) => `${handle} ${name ?? ''}`
  return rankFuzzyMatches(query, candidates, readText, SUGGESTION_LIMIT).map(({ item }) => item)
}
