import type { DiffSide } from '@shared/types'
import type { DiffRow } from './diff.util'
import { cx } from '../common/format.util'
import type { Tok } from '../highlight/highlight.service'

export const rowBg = (kind: DiffRow['kind']) => (kind === 'add' ? 'bg-add-bg' : kind === 'del' ? 'bg-del-bg' : '')

export function Gutter(props: {
  kind: DiffRow['kind']
  focus: boolean
  onDown: (shift: boolean) => void
  onEnter?: () => void
  divider?: boolean
  children: React.ReactNode
}) {
  return (
    <td
      title="Click to comment · drag or shift-click to select lines"
      onMouseDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault() // no text selection while dragging over lines
        props.onDown(e.shiftKey)
      }}
      onMouseEnter={props.onEnter}
      className={cx(
        'group relative w-[1%] cursor-pointer border-r border-line px-2 text-right align-top whitespace-nowrap text-muted/70 select-none hover:text-fg',
        props.divider && 'border-l',
        props.focus && 'shadow-[inset_3px_0_0_var(--color-focus)]',
        props.kind === 'add' && 'bg-add-strong/40',
        props.kind === 'del' && 'bg-del-strong/40',
      )}
    >
      <span className="pointer-events-none absolute top-0.5 -right-2.5 z-[1] hidden size-4 items-center justify-center rounded bg-accent text-[13px] leading-none text-accent-fg group-hover:flex">
        +
      </span>
      {props.children}
    </td>
  )
}

export function Sign({ kind }: { kind: DiffRow['kind'] }) {
  return <td className="w-4 pl-2 align-top text-muted select-none">{kind === 'add' ? '+' : kind === 'del' ? '−' : ''}</td>
}

export function Code({ row, idx, tokens }: { row: DiffRow; idx: number; tokens?: Tok[] }) {
  return (
    <td data-row={idx} className="pr-4 align-top break-all whitespace-pre-wrap select-text">
      {tokens?.length
        ? tokens.map((t, i) => (
            <span key={i} className="tok" style={t.style}>
              {t.text}
            </span>
          ))
        : row.text || ' '}
    </td>
  )
}

/** One side of a split row. The `group` hover lives on a wrapper so each half shows its own + button. */
export function Half(props: { row: DiffRow; idx: number; half: DiffSide; lineNo: number | null; tokens?: Tok[]; selected: boolean; focus: boolean; onDown: (shift: boolean) => void; onEnter: () => void; divider?: boolean }) {
  const bg = props.selected ? 'bg-accent/20' : props.row.kind === 'ctx' ? '' : rowBg(props.row.kind)
  return (
    <>
      <Gutter kind={props.row.kind} focus={props.focus} onDown={props.onDown} onEnter={props.onEnter} divider={props.divider}>
        {props.lineNo ?? ''}
      </Gutter>
      <td onMouseEnter={props.onEnter} className={cx('align-top', bg)}>
        <span className="block pl-1.5 text-muted select-none">{props.row.kind === 'add' ? '+' : props.row.kind === 'del' ? '−' : ''}</span>
      </td>
      <td onMouseEnter={props.onEnter} data-row={props.idx} data-half={props.half} className={cx('pr-3 align-top break-all whitespace-pre-wrap select-text', bg)}>
        {props.tokens?.length
          ? props.tokens.map((t, i) => (
              <span key={i} className="tok" style={t.style}>
                {t.text}
              </span>
            ))
          : props.row.text || ' '}
      </td>
    </>
  )
}

export function EmptyHalf({ divider }: { divider?: boolean }) {
  return <td colSpan={3} className={cx('bg-panel-2/60', divider && 'border-l border-line')} />
}

export function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

