import type { DiffSide } from '@shared/pull.types.ts'
import { type ReactNode, useMemo } from 'react'
import { type DiffRow, findRowAnchor, type HunkHeader, type LineRow, listRowKeys, toSplit } from './diff.util.ts'
import { EmptyHalf, Half, RowGroup } from './diff-cells.component.tsx'
import type { DiffTableProps } from './diff-table.types.ts'
import { HunkRow } from './hunk-row.component.tsx'
import type { Anchor } from './use-line-selection.hook.ts'

/** Columns per side: line number, sign, code. */
const SIDE_COLUMNS = 3

/** One side of a split row: the line, where it sits in `rows`, and what it anchors comments to. */
interface SideLine {
  row: LineRow
  idx: number
  anchor: Anchor | null
  notes: ReactNode
}

/** The line on one side of a split row, or null where that side has none. */
function renderSideLine(
  rows: readonly DiffRow[],
  index: number | null,
  side: DiffSide,
  notesFor: DiffTableProps['notesFor'],
): SideLine | null {
  if (index === null) {
    return null
  }
  const row = rows[index] as LineRow
  const anchor = findRowAnchor(row, side)
  return { row, idx: index, anchor, notes: notesFor(listRowKeys(row, side)) }
}

/** Line number, sign and code, for the old side then the new. */
function SplitColumns() {
  return (
    <colgroup>
      <col className="w-12" />
      <col className="w-5" />
      <col />
      <col className="w-12" />
      <col className="w-5" />
      <col />
    </colgroup>
  )
}

/** The comments under a line pair: the old side's under the old half, the new side's under the new. */
function NotesRow({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={SIDE_COLUMNS} className="border-y border-line bg-bg/60 px-3 py-2 align-top font-sans">
        {left}
      </td>
      <td colSpan={SIDE_COLUMNS} className="border-y border-l border-line bg-bg/60 px-3 py-2 align-top font-sans">
        {right}
      </td>
    </tr>
  )
}

export function SplitDiff({
  rows,
  tokens,
  selection,
  inFocus,
  commented,
  notesFor,
  onMouseUp,
  noteFor,
  onExpand,
}: DiffTableProps) {
  const split = useMemo(() => toSplit(rows), [rows])
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: mouseup reads the text selection to offer Ask Claude; it is not a control.
    <table onMouseUp={onMouseUp} className="w-full table-fixed border-collapse font-mono text-[12px] leading-[20px]">
      <SplitColumns />
      <tbody>
        {split.map((splitRow) => {
          if (splitRow.kind === 'hunk') {
            return (
              <HunkRow
                key={`hunk-${splitRow.idx}`}
                row={rows[splitRow.idx] as HunkHeader}
                span={2 * SIDE_COLUMNS}
                onExpand={onExpand}
              />
            )
          }
          const left = renderSideLine(rows, splitRow.left, 'LEFT', notesFor)
          const right = renderSideLine(rows, splitRow.right, 'RIGHT', notesFor)
          return (
            <RowGroup key={`line-${splitRow.left}-${splitRow.right}`}>
              <tr data-new-line={right?.row.newNo ?? undefined} data-old-line={left?.row.oldNo ?? undefined}>
                {left !== null && (
                  <Half
                    row={left.row}
                    idx={left.idx}
                    half="LEFT"
                    lineNo={left.row.oldNo}
                    tokens={tokens?.get(left.idx)}
                    selected={selection.contains(left.anchor)}
                    commented={commented(left.anchor)}
                    focus={false}
                    onDown={(shift) => selection.press(left.anchor, shift)}
                    onEnter={() => selection.over(left.anchor)}
                  />
                )}
                {left === null && <EmptyHalf />}
                {right !== null && (
                  <Half
                    row={right.row}
                    idx={right.idx}
                    half="RIGHT"
                    lineNo={right.row.newNo}
                    tokens={tokens?.get(right.idx)}
                    selected={selection.contains(right.anchor)}
                    commented={commented(right.anchor)}
                    focus={inFocus(right.row)}
                    onDown={(shift) => selection.press(right.anchor, shift)}
                    onEnter={() => selection.over(right.anchor)}
                    divider={true}
                    note={noteFor?.(right.row)}
                  />
                )}
                {right === null && <EmptyHalf divider={true} />}
              </tr>
              {Boolean(left?.notes || right?.notes) && <NotesRow left={left?.notes} right={right?.notes} />}
            </RowGroup>
          )
        })}
      </tbody>
    </table>
  )
}
