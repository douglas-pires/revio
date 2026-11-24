import type { Emoji } from '@shared/emoji.types.ts'
import { rankFuzzyMatches } from '../common/fuzzy-match.util.ts'

/** Emojis suggested at once. */
const SUGGESTION_LIMIT = 8

/** Suggested while only ":" is typed. */
const USUAL_NAMES = ['+1', 'heart', 'tada', 'rocket', 'eyes', 'smile', 'thinking', 'pray']

/** The emojis whose name matches what follows ":", best first; the usual ones when nothing follows yet. */
export function suggestEmojis(emojis: readonly Emoji[], query: string): Emoji[] {
  if (!query) {
    return USUAL_NAMES.flatMap((name) => emojis.find((emoji) => emoji.name === name) ?? [])
  }
  // Shorter names first, so among equal matches the whole name comes before names that only start with it.
  const byLength = emojis.toSorted((left, right) => left.name.length - right.name.length)
  return rankFuzzyMatches(query, byLength, ({ name }) => name, SUGGESTION_LIMIT).map(({ item }) => item)
}
