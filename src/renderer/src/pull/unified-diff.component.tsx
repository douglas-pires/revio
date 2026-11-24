import { joinClassNames } from '../common/format.util.ts'
import { findRowAnchor, listRowKeys } from './diff.util.ts'
import { Code, Gutter, RowGroup, Sign } from './diff-cells.component.tsx'
import { buildRowKey, pickRowBackground } from './diff-look.util.ts'
import type { DiffTableProps } from './diff-table.types.ts'
import { HunkRow } from './hunk-row.component.tsx'

/** Line numbers, sign, code. */
const COLUMNS = 3

export function UnifiedDiff({
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
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: mouseup reads the text selection to offer Ask Claude; it is not a control.
    <table onMouseUp={onMouseUp} className="w-full border-collapse font-mono text-[12px] leading-[20px]">
      <tbody>
        {rows.map((row, index) => {
          if (row.kind === 'hunk') {
            return <HunkRow key={buildRowKey(row)} row={row} span={COLUMNS} onExpand={onExpand} />
          }
          const anchor = findRowAnchor(row)
          const notes = notesFor(listRowKeys(row))
          return (
            <RowGroup key={buildRowKey(row)}>
              <tr
                onMouseEnter={() => selection.over(anchor)}
                data-new-line={row.newNo ?? undefined}
                data-old-line={row.oldNo ?? undefined}
                className={joinClassNames(
                  'group',
                  pickRowBackground(row.kind),
                  commented(anchor) && 'commented-line',
                  selection.contains(anchor) && '!bg-accent/20',
                )}
              >
                <Gutter
                  kind={row.kind}
                  focus={inFocus(row)}
                  commentable={Boolean(anchor)}
                  onDown={(shift) => selection.press(anchor, shift)}
                >
                  <span className="inline-block w-8">{row.oldNo ?? ''}</span>
                  <span className="inline-block w-8">{row.newNo ?? ''}</span>
                </Gutter>
                <Sign kind={row.kind} />
                <Code row={row} idx={index} tokens={tokens?.get(index)} note={noteFor?.(row)} />
              </tr>
              {Boolean(notes) && (
                <tr>
                  <td colSpan={COLUMNS} className="border-y border-line bg-bg/60 px-4 py-2 font-sans">
                    {notes}
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
