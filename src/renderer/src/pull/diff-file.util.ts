import type { DraftComment } from '@shared/pull.types.ts'
import type { DiffRow } from './diff.util.ts'
import type { LineSelection } from './use-line-selection.hook.ts'

/** "Line 12", "Lines 12–14", or "Old line…" for the removed side. */
export function rangeLabel(s: LineSelection) {
  let label = 'Line'
  if (s.side === 'LEFT') {
    label = 'Old line'
  }
  if (s.start === s.end) {
    return `${label} ${s.end}`
  }
  return `${label}s ${s.start}–${s.end}`
}

/** Whether a row's new-side line falls in one of the briefing's focus ranges. */
export function isInFocus(row: DiffRow, ranges: readonly [number, number][]) {
  if (row.kind === 'hunk' || row.newNo === null) {
    return false
  }
  const line = row.newNo
  return ranges.some(([a, b]) => line >= a && line <= b)
}

/** A draft comment on the selected lines; one line has no start, as GitHub expects. */
export function draftFromSelection(path: string, sel: LineSelection, body: string): Omit<DraftComment, 'id'> {
  const draft: Omit<DraftComment, 'id'> = { path, side: sel.side, line: sel.end, body }
  if (sel.start !== sel.end) {
    draft.startLine = sel.start
  }
  return draft
}

/** The line to open in the editor: the selected line on the new side, else the first changed line. */
export function editorLineOf(sel: LineSelection | null, patchRows: readonly DiffRow[]): number | undefined {
  if (sel?.side === 'RIGHT') {
    return sel.start
  }
  const changed =
    patchRows.find((r) => r.kind === 'add') ?? patchRows.find((r) => r.kind !== 'hunk' && r.newNo !== null)
  if (!changed || changed.kind === 'hunk') {
    return undefined
  }
  return changed.newNo ?? undefined
}
