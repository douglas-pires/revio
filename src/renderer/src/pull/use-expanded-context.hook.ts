import type { FileAtCommit } from '@shared/history.types.ts'
import { useCallback, useMemo, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import type { DiffRow } from './diff.util.ts'
import {
  countHiddenLines,
  type ExpandDirection,
  expandGap,
  expandRows,
  findGaps,
  type GapShown,
} from './diff-expand.util.ts'

const FINAL_NEWLINE = /\r?\n$/u
const NEWLINE = /\r?\n/u

/**
 * The diff rows with any lines the reviewer revealed around the hunks. The file at the PR head is fetched on the
 * first click, so files nobody expands cost nothing.
 */
export function useExpandedContext(at: FileAtCommit, rows: DiffRow[], enabled: boolean) {
  const [lines, setLines] = useState<string[] | null>(null)
  const [shown, setShown] = useState<ReadonlyMap<number, GapShown>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { repo, sha, path } = at

  const expanded = useMemo(() => {
    if (!enabled) {
      return rows
    }
    return expandRows(rows, lines, shown)
  }, [enabled, rows, lines, shown])

  const load = useCallback(async () => {
    if (lines) {
      return lines
    }
    const text = await globalThis.revio.getFileContent({ repo, sha, path })
    if (text === null) {
      throw new Error('GitHub did not return this file (binary or too large).')
    }
    const loaded = text.replace(FINAL_NEWLINE, '').split(NEWLINE)
    setLines(loaded)
    return loaded
  }, [lines, repo, sha, path])

  const expand = useCallback(
    async (index: number, direction: ExpandDirection) => {
      if (loading) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const file = await load()
        const gap = findGaps(rows, file.length)[index]
        if (gap) {
          setShown((prev) =>
            new Map(prev).set(index, expandGap(prev.get(index), direction, countHiddenLines(gap, prev.get(index)))),
          )
        }
      } catch (failure) {
        setError(readErrorMessage(failure))
      } finally {
        setLoading(false)
      }
    },
    [loading, load, rows],
  )

  return { rows: expanded, expand, loading, error }
}
