import type { DiffSide } from '@shared/pull.types'
import type { DiffRow } from './diff.util'

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
  if (!query) return []
  const hay = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const found: number[] = []
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) found.push(at)
  return found
}

/** Every occurrence of `query` in the diff lines of `files`, in file and line order, up to MAX_MATCHES. */
export function searchDiffs(files: readonly { path: string; rows: readonly DiffRow[] }[], query: string, options: SearchOptions): DiffMatch[] {
  const matches: DiffMatch[] = []
  for (const { path, rows } of files) {
    for (const row of rows) {
      if (row.kind === 'hunk') continue
      const side: DiffSide = row.kind === 'del' ? 'LEFT' : 'RIGHT'
      const line = side === 'LEFT' ? row.oldNo : row.newNo
      if (line == null) continue
      const hits = occurrences(row.text, query, options)
      for (let nth = 0; nth < hits.length; nth++) {
        if (matches.length >= MAX_MATCHES) return matches
        matches.push({ path, side, line, nth })
      }
    }
  }
  return matches
}

/** The match index after (or before) `index`, wrapping around; 0 when nothing is current yet. */
export function stepMatch(index: number | null, count: number, direction: 1 | -1): number | null {
  if (!count) return null
  if (index == null) return direction === 1 ? 0 : count - 1
  return (index + direction + count) % count
}
