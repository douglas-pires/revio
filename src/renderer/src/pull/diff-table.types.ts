import type { ReactNode } from 'react'
import type { Tok } from '../highlight/highlight.service'
import type { DiffRow, LineRow } from './diff.util'
import type { ExpandDirection } from './diff-expand.util'
import type { Anchor, LineSelectionApi } from './use-line-selection.hook'

/** What the unified and split tables share: the rows, their tokens, the selection and what goes under a line. */
export interface DiffTableProps {
  rows: DiffRow[]
  tokens: Map<number, Tok[]> | null
  selection: LineSelectionApi
  inFocus: (row: DiffRow) => boolean
  /** Comments and the comment box under a line, or null when there are none. */
  notesFor: (keys: string[], anchor: Anchor | null) => ReactNode
  onMouseUp: (e: React.MouseEvent) => void
  /** Shown after a line's code on hover, e.g. its blame. */
  noteFor?: (row: LineRow) => ReactNode
  /** Shows more of the file around the hunks; without it, separators have no buttons. */
  onExpand?: (gap: number, direction: ExpandDirection) => void
}
