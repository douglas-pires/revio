import { useMemo } from 'react'
import { anchorFor, keysOf, toSplit, type LineRow } from './diff.util'
import { EmptyHalf, Half, RowGroup } from './diff-cells.component'
import { HunkRow } from './hunk-row.component'
import type { DiffTableProps } from './diff-table.types'

export function SplitDiff({ rows, tokens, selection, inFocus, notesFor, onMouseUp, noteFor }: DiffTableProps) {
  const split = useMemo(() => toSplit(rows), [rows])
  return (
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
        {split.map((sr, i) => {
          if (sr.kind === 'hunk') return <HunkRow key={i} text={rows[sr.idx]!.text} span={6} />
          const L = sr.left != null ? (rows[sr.left] as LineRow) : null
          const R = sr.right != null ? (rows[sr.right] as LineRow) : null
          const la = L ? anchorFor(L, 'LEFT') : null
          const ra = R ? anchorFor(R, 'RIGHT') : null
          const leftNotes = L ? notesFor(keysOf(L, 'LEFT'), la) : null
          const rightNotes = R ? notesFor(keysOf(R, 'RIGHT'), ra) : null
          return (
            <RowGroup key={i}>
              <tr data-new-line={R?.newNo ?? undefined}>
                {L ? (
                  <Half row={L} idx={sr.left!} half="LEFT" lineNo={L.oldNo} tokens={tokens?.get(sr.left!)} selected={selection.contains(la)} focus={false} onDown={(shift) => selection.press(la, shift)} onEnter={() => selection.over(la)} />
                ) : (
                  <EmptyHalf />
                )}
                {R ? (
                  <Half row={R} idx={sr.right!} half="RIGHT" lineNo={R.newNo} tokens={tokens?.get(sr.right!)} selected={selection.contains(ra)} focus={inFocus(R)} onDown={(shift) => selection.press(ra, shift)} onEnter={() => selection.over(ra)} divider note={noteFor?.(R)} />
                ) : (
                  <EmptyHalf divider />
                )}
              </tr>
              {(leftNotes || rightNotes) && (
                <tr>
                  <td colSpan={3} className="border-y border-line bg-bg/60 px-3 py-2 align-top font-sans">
                    {leftNotes}
                  </td>
                  <td colSpan={3} className="border-y border-l border-line bg-bg/60 px-3 py-2 align-top font-sans">
                    {rightNotes}
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
