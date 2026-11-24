import type { DiffSide } from '@shared/pull.types.ts'
import { useEffect, useState } from 'react'
import { buildAnchorKey } from './diff.util.ts'

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
  const [selection, setSel] = useState<LineSelection | null>(null)
  const [dragging, setDragging] = useState<{ side: DiffSide; origin: number } | null>(null)

  useEffect(() => {
    if (!dragging) {
      return
    }
    const endDrag = () => setDragging(null)
    globalThis.addEventListener('mouseup', endDrag)
    return () => globalThis.removeEventListener('mouseup', endDrag)
  }, [dragging])

  const press = (anchor: Anchor | null, shift: boolean) => {
    if (!anchor) {
      return
    }
    if (shift && selection && selection.side === anchor.side) {
      setSel({
        side: anchor.side,
        start: Math.min(selection.start, anchor.line),
        end: Math.max(selection.end, anchor.line),
      })
      return
    }
    setSel({ side: anchor.side, start: anchor.line, end: anchor.line })
    setDragging({ side: anchor.side, origin: anchor.line })
  }

  const hoverAnchor = (anchor: Anchor | null) => {
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
    Boolean(
      anchor &&
        selection &&
        anchor.side === selection.side &&
        anchor.line >= selection.start &&
        anchor.line <= selection.end,
    )
  /** Whether the comment box goes under the row that owns these line keys. */
  const isComposerAt = (keys: readonly string[]) =>
    Boolean(!dragging && selection && keys.includes(buildAnchorKey(selection.side, selection.end)))

  return {
    sel: selection,
    select: setSel,
    clear: () => setSel(null),
    press,
    over: hoverAnchor,
    contains,
    composerAt: isComposerAt,
  }
}

export type LineSelectionApi = ReturnType<typeof useLineSelection>
