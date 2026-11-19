import type { DiffSide } from '@shared/pull.types.ts'
import { cx } from '../common/format.util.ts'
import type { Tok } from '../highlight/highlight.service.ts'
import { TokenText } from '../highlight/token-text.component.tsx'
import type { DiffRow } from './diff.util.ts'
import { DIFF_SIGNS, rowBg } from './diff-look.util.ts'

/** Columns per side of a split row: line number, sign, code. */
const SIDE_COLUMNS = 3

/** The gutter's tooltip: how to comment, or why this line cannot take comments. */
function gutterTitle(commentable: boolean) {
  if (commentable) {
    return 'Click to comment · drag or shift-click to select lines'
  }
  return 'Not part of the diff, so it cannot take comments'
}

/** A half's background: the selection's, else its kind's. */
function halfBackground(selected: boolean, kind: DiffRow['kind']) {
  if (selected) {
    return 'bg-accent/20'
  }
  return rowBg(kind)
}

export function Gutter(props: {
  kind: DiffRow['kind']
  focus: boolean
  onDown: (shift: boolean) => void
  onEnter?: (() => void) | undefined
  divider?: boolean | undefined
  /** False for lines shown from the file around the diff, which GitHub takes no comments on. */
  commentable?: boolean | undefined
  children: React.ReactNode
}) {
  const commentable = props.commentable ?? true
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: picking lines is a pointer gesture (press and drag across rows) on the line numbers.
    <td
      title={gutterTitle(commentable)}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return
        }
        e.preventDefault() // no text selection while dragging over lines
        props.onDown(e.shiftKey)
      }}
      onMouseEnter={props.onEnter}
      className={cx(
        'group relative w-[1%] border-r border-line px-2 text-right align-top whitespace-nowrap text-muted/70 select-none hover:text-fg',
        commentable && 'cursor-pointer',
        props.divider && 'border-l',
        props.focus && 'shadow-[inset_3px_0_0_var(--color-focus)]',
        props.kind === 'add' && 'bg-add-strong/40',
        props.kind === 'del' && 'bg-del-strong/40',
      )}
    >
      {/* Drawn over the next column, but a child of this cell: a press on it reaches the cell's handler. */}
      {Boolean(commentable) && (
        // A visual cue only: the press reaches the cell's mousedown handler, which owns the interaction.
        <span
          aria-hidden={true}
          className="absolute top-0.5 -right-2.5 z-[1] hidden size-4 cursor-pointer items-center justify-center rounded bg-accent text-[13px] leading-none text-accent-fg group-hover:flex"
        >
          +
        </span>
      )}
      {props.children}
    </td>
  )
}

export function Sign({ kind }: { kind: DiffRow['kind'] }) {
  return <td className="w-4 pl-2 align-top text-muted select-none">{DIFF_SIGNS[kind]}</td>
}

export function Code({
  row,
  idx,
  tokens,
  note,
}: {
  row: DiffRow
  idx: number
  tokens?: Tok[] | undefined
  note?: React.ReactNode
}) {
  return (
    <td data-row={idx} className="pr-4 align-top break-all whitespace-pre-wrap select-text">
      <TokenText tokens={tokens} text={row.text} />
      {note}
    </td>
  )
}

/** One side of a split row. The `group` hover lives on a wrapper so each half shows its own + button. */
export function Half(props: {
  row: DiffRow
  idx: number
  half: DiffSide
  lineNo: number | null
  tokens?: Tok[] | undefined
  selected: boolean
  focus: boolean
  onDown: (shift: boolean) => void
  onEnter: () => void
  divider?: boolean | undefined
  note?: React.ReactNode
}) {
  const bg = halfBackground(props.selected, props.row.kind)
  return (
    <>
      <Gutter
        kind={props.row.kind}
        focus={props.focus}
        onDown={props.onDown}
        onEnter={props.onEnter}
        divider={props.divider}
        commentable={!(props.row.kind !== 'hunk' && props.row.expanded)}
      >
        {props.lineNo ?? ''}
      </Gutter>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: hovering extends a line selection being dragged. */}
      <td onMouseEnter={props.onEnter} className={cx('align-top', bg)}>
        <span className="block pl-1.5 text-muted select-none">{DIFF_SIGNS[props.row.kind]}</span>
      </td>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: hovering extends a line selection being dragged. */}
      <td
        onMouseEnter={props.onEnter}
        data-row={props.idx}
        data-half={props.half}
        className={cx('pr-3 align-top break-all whitespace-pre-wrap select-text', bg)}
      >
        <TokenText tokens={props.tokens} text={props.row.text} />
        {props.note}
      </td>
    </>
  )
}

export function EmptyHalf({ divider = false }: { divider?: boolean }) {
  return <td colSpan={SIDE_COLUMNS} className={cx('bg-panel-2/60', divider && 'border-l border-line')} />
}

export function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
