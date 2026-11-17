import type { ReactNode } from 'react'
import type { Tok } from '../highlight/highlight.service'
import type { DiffRow } from './diff.util'
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
}
