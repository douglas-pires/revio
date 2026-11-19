import { useEffect, useState } from 'react'
import { type Tok, useHighlighter } from '../highlight/highlight.service.ts'
import type { DiffRow } from './diff.util.ts'

/**
 * Highlighted tokens per row index, computed once the file is open and near the viewport, and again when the rows
 * change (expanding context shifts the indices, so tokens for other rows are never shown).
 */
export function useRowTokens(path: string, patch: string | undefined, rows: DiffRow[], active: boolean) {
  const [result, setResult] = useState<{ rows: DiffRow[]; tokens: Map<number, Tok[]> | null } | null>(null)
  const highlighter = useHighlighter()
  const current = result?.rows === rows
  useEffect(() => {
    if (!(active && patch) || current) {
      return
    }
    let live = true
    highlighter
      .highlightRows(path, rows, patch.length)
      .then((tokens) => live && setResult({ rows, tokens }))
      .catch(() => {
        // Unhighlighted rows are still readable; nothing to report.
      })
    return () => {
      live = false
    }
  }, [active, path, patch, rows, current, highlighter])
  if (!current) {
    return null
  }
  return result.tokens
}
