import type { DiffSide } from '@shared/pull.types.ts'
import { useEffect, useState } from 'react'

export interface LineSelection {
  side: DiffSide
  start: number
  end: number
}

export interface Anchor {
  side: DiffSide
  line: number
}

/** Gutter selection: press to start, drag or shift-press to extend. The composer opens under the last line once the drag ends. */
export function useLineSelection() {
  const [sel, setSel] = useState<LineSelection | null>(null)
  const [dragging, setDragging] = useState<{ side: DiffSide; origin: number } | null>(null)

  useEffect(() => {
    if (!dragging) {
      return
    }
    const up = () => setDragging(null)
    globalThis.addEventListener('mouseup', up)
    return () => globalThis.removeEventListener('mouseup', up)
  }, [dragging])

  const press = (anchor: Anchor | null, shift: boolean) => {
    if (!anchor) {
      return
    }
    if (shift && sel && sel.side === anchor.side) {
      setSel({ side: anchor.side, start: Math.min(sel.start, anchor.line), end: Math.max(sel.end, anchor.line) })
      return
    }
    setSel({ side: anchor.side, start: anchor.line, end: anchor.line })
    setDragging({ side: anchor.side, origin: anchor.line })
  }

  const over = (anchor: Anchor | null) => {
    if (!(dragging && anchor) || anchor.side !== dragging.side) {
      return
    }
    setSel({
      side: anchor.side,
      start: Math.min(dragging.origin, anchor.line),
      end: Math.max(dragging.origin, anchor.line),
    })
  }

  const contains = (anchor: Anchor | null) =>
    Boolean(anchor && sel && anchor.side === sel.side && anchor.line >= sel.start && anchor.line <= sel.end)
  const composerAt = (anchor: Anchor | null) =>
    Boolean(!dragging && anchor && sel && sel.side === anchor.side && sel.end === anchor.line)

  return { sel, clear: () => setSel(null), press, over, contains, composerAt }
}

export type LineSelectionApi = ReturnType<typeof useLineSelection>
