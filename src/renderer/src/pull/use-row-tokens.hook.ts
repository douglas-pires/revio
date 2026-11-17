import { useEffect, useState } from 'react'
import type { DiffRow } from './diff.util'
import { useHighlighter, type Tok } from '../highlight/highlight.service'

/** Highlighted tokens per row index, computed once the file is open and near the viewport. */
export function useRowTokens(path: string, patch: string | undefined, rows: DiffRow[], active: boolean) {
  const [tokens, setTokens] = useState<Map<number, Tok[]> | null>(null)
  const highlighter = useHighlighter()
  useEffect(() => {
    if (!active || !patch || tokens) return
    let live = true
    highlighter
      .highlightRows(path, rows, patch.length)
      .then((t) => live && setTokens(t))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [active, path, patch, rows, tokens, highlighter])
  return tokens
}
