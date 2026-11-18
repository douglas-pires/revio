import { anchorFor, keysOf } from './diff.util'
import { cx } from '../common/format.util'
import { Code, Gutter, RowGroup, Sign, rowBg } from './diff-cells.component'
import { HunkRow } from './hunk-row.component'
import type { DiffTableProps } from './diff-table.types'

export function UnifiedDiff({ rows, tokens, selection, inFocus, notesFor, onMouseUp, noteFor, onExpand }: DiffTableProps) {
  return (
    <table onMouseUp={onMouseUp} className="w-full border-collapse font-mono text-[12px] leading-[20px]">
      <tbody>
        {rows.map((row, i) => {
          if (row.kind === 'hunk') return <HunkRow key={i} row={row} span={3} onExpand={onExpand} />
          const a = anchorFor(row)
          const notes = notesFor(keysOf(row), a)
          return (
            <RowGroup key={i}>
              <tr onMouseEnter={() => selection.over(a)} data-new-line={row.newNo ?? undefined} data-old-line={row.oldNo ?? undefined} className={cx('group', rowBg(row.kind), selection.contains(a) && '!bg-accent/20')}>
                <Gutter kind={row.kind} focus={inFocus(row)} commentable={!!a} onDown={(shift) => selection.press(a, shift)}>
                  <span className="inline-block w-8">{row.oldNo ?? ''}</span>
                  <span className="inline-block w-8">{row.newNo ?? ''}</span>
                </Gutter>
                <Sign kind={row.kind} />
                <Code row={row} idx={i} tokens={tokens?.get(i)} note={noteFor?.(row)} />
              </tr>
              {notes && (
                <tr>
                  <td colSpan={3} className="border-y border-line bg-bg/60 px-4 py-2 font-sans">
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
