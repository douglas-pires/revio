import type { DiffSide } from '@shared/pull.types.ts'
import { type ReactNode, useMemo } from 'react'
import { anchorFor, type DiffRow, type HunkHeader, keysOf, type LineRow, toSplit } from './diff.util.ts'
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
function sideLine(
  rows: readonly DiffRow[],
  idx: number | null,
  side: DiffSide,
  notesFor: DiffTableProps['notesFor'],
): SideLine | null {
  if (idx === null) {
    return null
  }
  const row = rows[idx] as LineRow
  const anchor = anchorFor(row, side)
  return { row, idx, anchor, notes: notesFor(keysOf(row, side), anchor) }
}

export function SplitDiff({
  rows,
  tokens,
  selection,
  inFocus,
  notesFor,
  onMouseUp,
  noteFor,
  onExpand,
}: DiffTableProps) {
  const split = useMemo(() => toSplit(rows), [rows])
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: mouseup reads the text selection to offer Ask Claude; it is not a control.
    <table onMouseUp={onMouseUp} className="w-full table-fixed border-collapse font-mono text-[12px] leading-[20px]">
      <colgroup>
        <col className="w-12" />
        <col className="w-5" />
        <col />
        <col className="w-12" />
        <col className="w-5" />
        <col />
      </colgroup>
      <tbody>
        {split.map((sr) => {
          if (sr.kind === 'hunk') {
            return (
              <HunkRow
                key={`hunk-${sr.idx}`}
                row={rows[sr.idx] as HunkHeader}
                span={2 * SIDE_COLUMNS}
                onExpand={onExpand}
              />
            )
          }
          const left = sideLine(rows, sr.left, 'LEFT', notesFor)
          const right = sideLine(rows, sr.right, 'RIGHT', notesFor)
          return (
            <RowGroup key={`line-${sr.left}-${sr.right}`}>
              <tr data-new-line={right?.row.newNo ?? undefined} data-old-line={left?.row.oldNo ?? undefined}>
                {left !== null && (
                  <Half
                    row={left.row}
                    idx={left.idx}
                    half="LEFT"
                    lineNo={left.row.oldNo}
                    tokens={tokens?.get(left.idx)}
                    selected={selection.contains(left.anchor)}
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
                    focus={inFocus(right.row)}
                    onDown={(shift) => selection.press(right.anchor, shift)}
                    onEnter={() => selection.over(right.anchor)}
                    divider={true}
                    note={noteFor?.(right.row)}
                  />
                )}
                {right === null && <EmptyHalf divider={true} />}
              </tr>
              {Boolean(left?.notes || right?.notes) && (
                <tr>
                  <td colSpan={SIDE_COLUMNS} className="border-y border-line bg-bg/60 px-3 py-2 align-top font-sans">
                    {left?.notes}
                  </td>
                  <td
                    colSpan={SIDE_COLUMNS}
                    className="border-y border-l border-line bg-bg/60 px-3 py-2 align-top font-sans"
                  >
                    {right?.notes}
                  </td>
                </tr>
              )}
            </RowGroup>
          )
        })}
      </tbody>
    </table>
  )
}
