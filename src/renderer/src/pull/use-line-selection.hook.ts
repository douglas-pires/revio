import { useEffect, useState } from 'react'
import type { DiffSide } from '@shared/pull.types'

export interface LineSelection {
  side: DiffSide
  start: number
  end: number
}

export type Anchor = { side: DiffSide; line: number }

/** Gutter selection: press to start, drag or shift-press to extend. The composer opens under the last line once the drag ends. */
export function useLineSelection() {
  const [sel, setSel] = useState<LineSelection | null>(null)
  const [dragging, setDragging] = useState<{ side: DiffSide; origin: number } | null>(null)

  useEffect(() => {
    if (!dragging) return
    const up = () => setDragging(null)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [dragging])

  const press = (a: Anchor | null, shift: boolean) => {
    if (!a) return
    if (shift && sel && sel.side === a.side) {
      setSel({ side: a.side, start: Math.min(sel.start, a.line), end: Math.max(sel.end, a.line) })
      return
    }
    setSel({ side: a.side, start: a.line, end: a.line })
    setDragging({ side: a.side, origin: a.line })
  }

  const over = (a: Anchor | null) => {
    if (!dragging || !a || a.side !== dragging.side) return
    setSel({ side: a.side, start: Math.min(dragging.origin, a.line), end: Math.max(dragging.origin, a.line) })
  }

  const contains = (a: Anchor | null) => !!(a && sel && a.side === sel.side && a.line >= sel.start && a.line <= sel.end)
  const composerAt = (a: Anchor | null) => !!(!dragging && a && sel && sel.side === a.side && sel.end === a.line)

  return { sel, clear: () => setSel(null), press, over, contains, composerAt }
}

export type LineSelectionApi = ReturnType<typeof useLineSelection>
