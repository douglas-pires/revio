import type { DiffSide } from '@shared/pull.types.ts'
import { useEffect, useState } from 'react'
import { type DiffRow, lineRangeOfRows } from './diff.util.ts'

/** The node itself when it is an element, else the element holding it (a text node's parent). */
function elementOf(node: Node | null) {
  if (node instanceof Element) {
    return node
  }
  return node?.parentElement
}

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
    if (!floating) {
      return
    }
    const hide = () => setFloating(null)
    document.addEventListener('mousedown', hide)
    return () => document.removeEventListener('mousedown', hide)
  }, [floating])

  const onMouseUp = (event: React.MouseEvent) => {
    const selection = globalThis.getSelection()
    if (!selection || selection.isCollapsed) {
      return
    }
    const cellOf = (node: Node | null) => elementOf(node)?.closest<HTMLElement>('td[data-row]')
    const anchorCell = cellOf(selection.anchorNode)
    const focusCell = cellOf(selection.focusNode)
    if (!(anchorCell && focusCell)) {
      return
    }
    const range = lineRangeOfRows(
      rows,
      Number(anchorCell.dataset.row),
      Number(focusCell.dataset.row),
      anchorCell.dataset.half as DiffSide | undefined,
    )
    if (range) {
      setFloating({ x: event.clientX, y: event.clientY, ...range })
    }
  }

  return { floating, onMouseUp, dismiss: () => setFloating(null) }
}
