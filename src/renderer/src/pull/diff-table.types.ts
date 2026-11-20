import type { ReactNode } from 'react'
import type { Tok } from '../highlight/highlight.service.ts'
import type { DiffRow, LineRow } from './diff.util.ts'
import type { ExpandDirection } from './diff-expand.util.ts'
import type { Anchor, LineSelectionApi } from './use-line-selection.hook.ts'

/** What the unified and split tables share: the rows, their tokens, the selection and what goes under a line. */
export interface DiffTableProps {
  rows: DiffRow[]
  tokens: Map<number, Tok[]> | null
  selection: LineSelectionApi
  inFocus: (row: DiffRow) => boolean
  /** Whether a comment (yours pending, or on GitHub) is on this line, to keep it marked. */
  commented: (anchor: Anchor | null) => boolean
  /** Comments and the comment box under a line, or null when there are none. */
  notesFor: (keys: string[], anchor: Anchor | null) => ReactNode
  onMouseUp: (e: React.MouseEvent) => void
  /** Shown after a line's code on hover, e.g. its blame. */
  noteFor?: ((row: LineRow) => ReactNode) | undefined
  /** Shows more of the file around the hunks; without it, separators have no buttons. */
  onExpand?: ((gap: number, direction: ExpandDirection) => void) | undefined
}
