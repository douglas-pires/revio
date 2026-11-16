import { useCallback, useState } from 'react'
import type { DiffView } from '../components/DiffFile'

const KEY = 'revio.diffView'

function readStoredView(): DiffView {
  try {
    return localStorage.getItem(KEY) === 'split' ? 'split' : 'unified'
  } catch {
    return 'unified'
  }
}

/** Unified/split choice, remembered per viewer in localStorage (a convenience: failures are ignored). */
export function useDiffViewPreference() {
  const [view, setView] = useState<DiffView>(readStoredView)
  const changeView = useCallback((next: DiffView) => {
    setView(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* private mode or blocked storage: keep the in-memory choice */
    }
  }, [])
  return [view, changeView] as const
}
