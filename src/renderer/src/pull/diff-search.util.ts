import type { DiffSide } from '@shared/pull.types.ts'

import type { DiffRow, LineRow } from './diff.util.ts'

/** A removed line is found by its old number; added and kept lines by their new one. */
function placeOf(row: LineRow): { side: DiffSide; line: number | null } {
  if (row.kind === 'del') {
    return { side: 'LEFT', line: row.oldNo }
  }
  return { side: 'RIGHT', line: row.newNo }
}

/** Each occurrence of `query` in one diff line. */
function matchesInRow(path: string, row: LineRow, query: string, options: SearchOptions): DiffMatch[] {
  const { side, line } = placeOf(row)
  if (line === null) {
    return []
  }
  return occurrences(row.text, query, options).map((_, nth) => ({ path, side, line, nth }))
}

/** One occurrence of the search text in a diff line. */
export interface DiffMatch {
  path: string
  /** RIGHT for added and unchanged lines (by new line number), LEFT for removed ones (by old line number). */
  side: DiffSide
  line: number
  /** Which occurrence in that line, counting from 0. */
  nth: number
}

export interface SearchOptions {
  caseSensitive: boolean
}

/** More than this and the count reads "1000+"; stepping through that many is not what anyone does. */
export const MAX_MATCHES = 1000

/** Start offsets of `query` in `text`, without overlaps. */
export function occurrences(text: string, query: string, { caseSensitive }: SearchOptions): number[] {
  if (!query) {
    return []
  }
  let hay = text.toLowerCase()
  let needle = query.toLowerCase()
  if (caseSensitive) {
    hay = text
    needle = query
  }
  const found: number[] = []
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) {
    found.push(at)
  }
  return found
}

/** Every occurrence of `query` in the diff lines of `files`, in file and line order, up to MAX_MATCHES. */
export function searchDiffs(
  files: readonly { path: string; rows: readonly DiffRow[] }[],
  query: string,
  options: SearchOptions,
): DiffMatch[] {
  const matches: DiffMatch[] = []
  for (const { path, rows } of files) {
    for (const row of rows.filter((candidate): candidate is LineRow => candidate.kind !== 'hunk')) {
      matches.push(...matchesInRow(path, row, query, options))
      if (matches.length >= MAX_MATCHES) {
        return matches.slice(0, MAX_MATCHES)
      }
    }
  }
  return matches
}

/** The match index after (or before) `index`, wrapping around; 0 when nothing is current yet. */
export function stepMatch(index: number | null, count: number, direction: 1 | -1): number | null {
  if (!count) {
    return null
  }
  if (index === null && direction === 1) {
    return 0
  }
  if (index === null) {
    return count - 1
  }
  return (index + direction + count) % count
}
