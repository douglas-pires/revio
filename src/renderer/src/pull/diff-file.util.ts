import type { DraftComment } from '@shared/pull.types.ts'
import type { DiffRow } from './diff.util.ts'
import type { LineSelection } from './use-line-selection.hook.ts'

/** "Line 12", "Lines 12–14", or "Old line…" for the removed side. */
export function describeRange(selection: LineSelection) {
  let label = 'Line'
  if (selection.side === 'LEFT') {
    label = 'Old line'
  }
  if (selection.start === selection.end) {
    return `${label} ${selection.end}`
  }
  return `${label}s ${selection.start}–${selection.end}`
}

/** Whether a row's new-side line falls in one of the briefing's focus ranges. */
export function isInFocus(row: DiffRow, ranges: readonly [number, number][]) {
  if (row.kind === 'hunk' || row.newNo === null) {
    return false
  }
  const line = row.newNo
  return ranges.some(([start, end]) => line >= start && line <= end)
}

/** A draft comment on the selected lines; one line has no start, as GitHub expects. */
export function buildDraftFromSelection(
  path: string,
  selection: LineSelection,
  body: string,
): Omit<DraftComment, 'id'> {
  const draft: Omit<DraftComment, 'id'> = { path, side: selection.side, line: selection.end, body }
  if (selection.start !== selection.end) {
    draft.startLine = selection.start
  }
  return draft
}

/** The line to open in the editor: the selected line on the new side, else the first changed line. */
export function findEditorLine(selection: LineSelection | null, patchRows: readonly DiffRow[]): number | undefined {
  if (selection?.side === 'RIGHT') {
    return selection.start
  }
  const changed =
    patchRows.find((row) => row.kind === 'add') ?? patchRows.find((row) => row.kind !== 'hunk' && row.newNo !== null)
  if (!changed || changed.kind === 'hunk') {
    return undefined
  }
  return changed.newNo ?? undefined
}
