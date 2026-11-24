import { type RankedMatch, rankFuzzyMatches } from '../common/fuzzy-match.util.ts'

/** Files listed at once; more would only be scrolled past. */
const RESULT_LIMIT = 50

/** The files matching `query` by path, best first; with no query, all of them in the order the diff shows them. */
export function rankFiles<T extends { path: string }>(files: readonly T[], query: string): RankedMatch<T>[] {
  if (!query.trim()) {
    return files.slice(0, RESULT_LIMIT).map((item) => ({ item, score: 0, positions: [] }))
  }
  return rankFuzzyMatches(query, files, (file) => file.path, RESULT_LIMIT)
}

/** A path's folder and file name, each with the matched positions that fall in it (counted from its own start). */
export function splitMatchedPath(path: string, positions: readonly number[]) {
  const nameStart = path.lastIndexOf('/') + 1
  return {
    folder: path.slice(0, nameStart),
    folderPositions: positions.filter((position) => position < nameStart),
    name: path.slice(nameStart),
    namePositions: positions.filter((position) => position >= nameStart).map((position) => position - nameStart),
  }
}
