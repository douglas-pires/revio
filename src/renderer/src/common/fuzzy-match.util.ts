/** Characters after which a new word starts: path and name separators. */
const WORD_SEPARATORS = new Set([' ', '/', '-', '_', '.', ':', '(', '['])
const WHITESPACE = /\s+/gu
const UPPERCASE = /\p{Lu}/u

/** Points for a matched letter, and the extras for a run of letters, a word's first letter, and a file's name. */
const MATCH_POINTS = 1
const RUN_BONUS = 4
const WORD_START_BONUS = 3
const FILE_NAME_BONUS = 1
/** Points lost per letter skipped between two matches (up to `MAX_GAP_PENALTY`), and before the first one. */
const GAP_PENALTY = 0.3
const MAX_GAP_PENALTY = 1.5
const LEADING_GAP_PENALTY = 0.1
const MAX_LEADING_GAP_PENALTY = 1

/** Whether a word starts at `index`: the first character, after a separator, or a capital after a lowercase letter. */
function startsWord(text: string, index: number) {
  if (index === 0) {
    return true
  }
  const previous = text.charAt(index - 1)
  const current = text.charAt(index)
  return WORD_SEPARATORS.has(previous) || (UPPERCASE.test(current) && previous === previous.toLowerCase())
}

/** The query's letters matched in order from `firstIndex`, each at its next occurrence; null when one is missing. */
function matchFrom(needle: string, haystack: string, firstIndex: number): number[] | null {
  const positions = [firstIndex]
  let searchFrom = firstIndex + 1
  for (const letter of needle.slice(1)) {
    const found = haystack.indexOf(letter, searchFrom)
    if (found < 0) {
      return null
    }
    positions.push(found)
    searchFrom = found + 1
  }
  return positions
}

/** The score of matching at `positions`: runs, word starts and the file name earn points, gaps lose them. */
function scorePositions(text: string, positions: readonly number[]) {
  const fileNameStart = text.lastIndexOf('/') + 1
  let score = 0
  positions.forEach((position, order) => {
    score += MATCH_POINTS
    const previous = positions[order - 1]
    if (previous === undefined) {
      score -= Math.min(position * LEADING_GAP_PENALTY, MAX_LEADING_GAP_PENALTY)
    } else if (position === previous + 1) {
      score += RUN_BONUS
    } else {
      score -= Math.min((position - previous - 1) * GAP_PENALTY, MAX_GAP_PENALTY)
    }
    if (startsWord(text, position)) {
      score += WORD_START_BONUS
    }
    if (position >= fileNameStart) {
      score += FILE_NAME_BONUS
    }
  })
  return score
}

/** How a candidate matches: its score (higher is better) and which characters matched, for highlighting. */
export interface FuzzyMatch {
  score: number
  positions: number[]
}

/** A candidate with its match, as `rankFuzzyMatches` returns them. */
export interface RankedMatch<T> extends FuzzyMatch {
  item: T
}

/**
 * How `text` matches `query` the way fzf does: every letter of the query, in order, ignoring case and spaces. Of the
 * ways to match, the best scoring one wins. Null when the letters are not all there, or so scattered that the match
 * says nothing (on average less than a point per letter).
 */
export function matchFuzzy(query: string, text: string): FuzzyMatch | null {
  const needle = query.replace(WHITESPACE, '').toLowerCase()
  if (!needle) {
    return { score: 0, positions: [] }
  }
  const haystack = text.toLowerCase()
  let best: FuzzyMatch | null = null
  for (
    let start = haystack.indexOf(needle.charAt(0));
    start >= 0;
    start = haystack.indexOf(needle.charAt(0), start + 1)
  ) {
    const positions = matchFrom(needle, haystack, start)
    if (!positions) {
      break
    }
    const score = scorePositions(text, positions)
    if (!best || score > best.score) {
      best = { score, positions }
    }
  }
  if (!best || best.score < needle.length) {
    return null
  }
  return best
}

/** The candidates matching `query`, best first (ties keep their order), at most `limit` of them. */
export function rankFuzzyMatches<T>(
  query: string,
  items: readonly T[],
  readText: (item: T) => string,
  limit: number,
): RankedMatch<T>[] {
  return items
    .map((item) => ({ item, match: matchFuzzy(query, readText(item)) }))
    .filter((candidate): candidate is { item: T; match: FuzzyMatch } => candidate.match !== null)
    .sort((left, right) => right.match.score - left.match.score)
    .slice(0, limit)
    .map(({ item, match }) => ({ item, ...match }))
}
