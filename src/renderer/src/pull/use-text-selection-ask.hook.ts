import { useEffect, useState } from 'react'
import type { DiffSide } from '@shared/pull.types'
import { lineRangeOfRows, type DiffRow } from './diff.util'

export interface FloatingAsk {
  x: number
  y: number
  side: DiffSide
  start: number
  end: number
}

/** Mouse-selecting code text offers "Ask Claude" for the lines the selection spans. Any later press hides the offer. */
export function useTextSelectionAsk(rows: readonly DiffRow[]) {
  const [floating, setFloating] = useState<FloatingAsk | null>(null)
  useEffect(() => {
    if (!floating) return
    const hide = () => setFloating(null)
    document.addEventListener('mousedown', hide)
    return () => document.removeEventListener('mousedown', hide)
  }, [floating])

  const onMouseUp = (e: React.MouseEvent) => {
    const s = window.getSelection()
    if (!s || s.isCollapsed) return
    const cellOf = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('td[data-row]')
    const a = cellOf(s.anchorNode)
    const b = cellOf(s.focusNode)
    if (!a || !b) return
    const range = lineRangeOfRows(rows, Number(a.dataset.row), Number(b.dataset.row), a.dataset.half as DiffSide | undefined)
    if (range) setFloating({ x: e.clientX, y: e.clientY, ...range })
  }

  return { floating, onMouseUp, dismiss: () => setFloating(null) }
}
