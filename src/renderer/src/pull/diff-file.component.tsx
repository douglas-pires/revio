import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { FocusItem } from '@shared/claude.types'
import type { DiffSide, DraftComment, PullFile, ReviewComment } from '@shared/pull.types'
import { anchorFor, anchorKey, keysOf, parsePatch, parseRange, toSplit, type DiffRow, type LineRow } from './diff.util'
import { cx } from '../common/format.util'
import { useHighlighter, type Tok } from '../highlight/highlight.service'
import { useNearViewport } from './use-near-viewport.hook'
import { Code, EmptyHalf, Gutter, Half, RowGroup, Sign, rowBg } from './diff-cells.component'
import { CommentView, Composer, DraftView, Thread } from './review-comments.component'
import { groupCommentThreads } from './comment-threads.util'
import { DiffFileHeader } from './diff-file-header.component'
import { FileComments } from './file-comments.component'
import { EMPTY } from '../common/group.util'

export type DiffView = 'unified' | 'split'

export interface AskSelection {
  path: string
  side: DiffSide
  startLine: number
  endLine: number
  snippet: string
}

export interface DiffFileProps {
  file: PullFile
  view: DiffView
  comments: readonly ReviewComment[]
  drafts: readonly DraftComment[]
  focus: readonly FocusItem[]
  ignoreReason?: string
  viewed: boolean
  /** The file j/k navigation is on. */
  current?: boolean
  collapsed: boolean
  onToggleCollapsed: (path: string, collapsed: boolean) => void
  onToggleViewed: (path: string, sha: string, viewed: boolean) => void
  onAddDraft: (d: Omit<DraftComment, 'id'>) => void
  onUpdateDraft: (id: string, body: string) => void
  onDeleteDraft: (id: string) => void
  onReplyNow: (commentId: number, body: string) => Promise<void>
  onAsk: (selection: AskSelection) => void
}

interface Selection {
  side: DiffSide
  start: number
  end: number
}

type Anchor = { side: DiffSide; line: number }

export const DiffFile = memo(function DiffFile(props: DiffFileProps) {
  const { file, collapsed, view } = props
  const setCollapsed = (value: boolean) => props.onToggleCollapsed(file.path, value)
  const [sel, setSel] = useState<Selection | null>(null)
  const rows = useMemo(() => (file.patch ? parsePatch(file.patch) : []), [file.patch])
  const split = useMemo(() => (view === 'split' ? toSplit(rows) : []), [rows, view])
  const [tokens, setTokens] = useState<Map<number, Tok[]> | null>(null)
  const highlighter = useHighlighter()

  // Only files near the visible area render their diff body; the rest keep a same-height placeholder.
  const container = useRef<HTMLDivElement>(null)
  const [focusWithin, setFocusWithin] = useState(false)
  // Never unmount a body the reviewer is working in (selection or a focused comment box).
  const near = useNearViewport(container, !!sel || focusWithin)
  const bodyHeight = useBodyHeight(near && !collapsed)

  useEffect(() => {
    if (collapsed || !near || !file.patch || tokens) return
    let live = true
    highlighter
      .highlightRows(file.path, rows, file.patch.length)
      .then((t) => live && setTokens(t))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [collapsed, near, file.path, file.patch, rows, tokens, highlighter])

  const focusRanges = useMemo(
    () => props.focus.map((f) => parseRange(f.lines)).filter((r): r is [number, number] => !!r),
    [props.focus],
  )

  const { threads, fileThreads } = useMemo(() => {
    const byLine = new Map<string, ReviewComment[][]>()
    const onFile: ReviewComment[][] = []
    for (const t of groupCommentThreads(props.comments, EMPTY, [file.path])) {
      if (t.onFile) onFile.push(t.comments)
      else if (!t.outdated && t.line != null) byLine.set(anchorKey(t.side, t.line), [...(byLine.get(anchorKey(t.side, t.line)) ?? []), t.comments])
    }
    return { threads: byLine, fileThreads: onFile }
  }, [props.comments, file.path])
  const [composingFileComment, setComposingFileComment] = useState(false)

  const outdated = props.comments.filter((c) => c.outdated && !c.inReplyTo)

  const draftsAt = useMemo(() => {
    const m = new Map<string, DraftComment[]>()
    for (const d of props.drafts) {
      if (d.inReplyTo || d.line == null) continue
      const k = anchorKey(d.side, d.line)
      m.set(k, [...(m.get(k) ?? []), d])
    }
    return m
  }, [props.drafts])

  /** Gutter press: starts a selection (drag to extend) or, with shift, extends the current one. */
  const [dragging, setDragging] = useState<{ side: DiffSide; origin: number } | null>(null)
  const pressGutter = (a: Anchor | null, shift: boolean) => {
    if (!a) return
    if (shift && sel && sel.side === a.side) {
      setSel({ side: a.side, start: Math.min(sel.start, a.line), end: Math.max(sel.end, a.line) })
      return
    }
    setSel({ side: a.side, start: a.line, end: a.line })
    setDragging({ side: a.side, origin: a.line })
  }
  const dragOver = (a: Anchor | null) => {
    if (!dragging || !a || a.side !== dragging.side) return
    setSel({ side: a.side, start: Math.min(dragging.origin, a.line), end: Math.max(dragging.origin, a.line) })
  }
  useEffect(() => {
    if (!dragging) return
    const up = () => setDragging(null)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [dragging])

  const inSel = (a: Anchor | null) => !!(a && sel && a.side === sel.side && a.line >= sel.start && a.line <= sel.end)
  const inFocus = (row: DiffRow) => row.kind !== 'hunk' && row.newNo != null && focusRanges.some(([a, b]) => row.newNo! >= a && row.newNo! <= b)

  const selectedText = () =>
    sel && sel.side === 'RIGHT'
      ? rows
          .filter((r) => r.kind !== 'hunk' && r.newNo != null && r.newNo >= sel.start && r.newNo <= sel.end)
          .map((r) => r.text)
          .join('\n')
      : undefined

  /** Threads, drafts and the open composer that belong under a row (or half-row). */
  const annotations = (keys: string[], anchor: Anchor | null) => {
    const ts = keys.flatMap((k) => threads.get(k) ?? [])
    const ds = keys.flatMap((k) => draftsAt.get(k) ?? [])
    const composer = !!(!dragging && anchor && sel && sel.side === anchor.side && sel.end === anchor.line)
    if (!ts.length && !ds.length && !composer) return null
    return (
      <div className="max-w-3xl space-y-2">
        {ts.map((t) => {
          const root = t[0]!
          return (
            <Thread
              key={root.id}
              thread={t}
              drafts={props.drafts.filter((d) => d.inReplyTo === root.id)}
              onReplyNow={(body) => props.onReplyNow(root.id, body)}
              onReplyLater={(body) => props.onAddDraft({ path: file.path, side: root.side, line: root.line!, body, inReplyTo: root.id })}
              onUpdateDraft={props.onUpdateDraft}
              onDeleteDraft={props.onDeleteDraft}
            />
          )
        })}
        {ds.map((d) => (
          <DraftView key={d.id} d={d} onUpdate={props.onUpdateDraft} onDelete={props.onDeleteDraft} />
        ))}
        {composer && sel && (
          <Composer
            onAsk={() => {
              ask(sel.side, sel.start, sel.end)
              setSel(null)
            }}
            label={`${sel.side === 'LEFT' ? 'Old line' : 'Line'}${sel.start === sel.end ? ` ${sel.end}` : `s ${sel.start}–${sel.end}`}`}
            suggestion={selectedText()}
            onCancel={() => setSel(null)}
            onSubmit={(body) => {
              props.onAddDraft({
                path: file.path,
                side: sel.side,
                line: sel.end,
                startLine: sel.start !== sel.end ? sel.start : undefined,
                body,
              })
              setSel(null)
            }}
          />
        )}
      </div>
    )
  }

  const hunkRow = (row: DiffRow, key: number, span: number) => (
    <tr key={key} className="bg-hunk text-muted">
      <td colSpan={span} className="px-3 py-0.5 select-text">
        {row.text}
      </td>
    </tr>
  )

  // ------------------------------------------------------------ ask Claude about a selection

  /** Diff rows covering (side, start..end), with +/- markers, for the snippet shown to Claude. */
  const snippetFor = (side: DiffSide, start: number, end: number) => {
    const hit = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.kind !== 'hunk' && (side === 'LEFT' ? r.oldNo != null && r.oldNo >= start && r.oldNo <= end : r.newNo != null && r.newNo >= start && r.newNo <= end))
    if (!hit.length) return ''
    return rows
      .slice(hit[0]!.i, hit.at(-1)!.i + 1)
      .filter((r) => r.kind !== 'hunk' && !(side === 'LEFT' && r.kind === 'add'))
      .map((r) => `${r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ' '}${r.text}`)
      .join('\n')
  }
  const ask = (side: DiffSide, start: number, end: number) =>
    props.onAsk({ path: file.path, side, startLine: start, endLine: end, snippet: snippetFor(side, start, end) })

  const [floating, setFloating] = useState<{ x: number; y: number; side: DiffSide; start: number; end: number } | null>(null)
  useEffect(() => {
    if (!floating) return
    const hide = () => setFloating(null)
    document.addEventListener('mousedown', hide)
    return () => document.removeEventListener('mousedown', hide)
  }, [floating])

  /** Mouse-selecting code text offers "Ask Claude" for the rows the selection spans. */
  const onMouseUp = (e: React.MouseEvent) => {
    const s = window.getSelection()
    if (!s || s.isCollapsed) return
    const cellOf = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('td[data-row]')
    const a = cellOf(s.anchorNode)
    const b = cellOf(s.focusNode)
    if (!a || !b) return
    const [i0, i1] = [Number(a.dataset.row), Number(b.dataset.row)].sort((x, y) => x - y) as [number, number]
    const slice = rows.slice(i0, i1 + 1).filter((r): r is LineRow => r.kind !== 'hunk')
    const half = a.dataset.half as DiffSide | undefined
    const side: DiffSide = half ?? (slice.every((r) => r.kind === 'del') ? 'LEFT' : 'RIGHT')
    const nums = slice.map((r) => (side === 'LEFT' ? (r.kind === 'add' ? null : r.oldNo) : r.kind === 'del' ? null : r.newNo)).filter((n): n is number => n != null)
    if (!nums.length) return
    setFloating({ x: e.clientX, y: e.clientY, side, start: Math.min(...nums), end: Math.max(...nums) })
  }

  return (
    <div
      ref={container}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocusWithin(false)}
      id={`file-${file.path}`}
      className={cx('scroll-mt-2 overflow-hidden rounded-lg border bg-panel', props.current ? 'border-accent ring-1 ring-accent/40' : 'border-line')}>
      <DiffFileHeader
        file={file}
        collapsed={collapsed}
        focus={props.focus}
        ignoreReason={props.ignoreReason}
        commentCount={props.comments.length + props.drafts.length}
        viewed={props.viewed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onToggleViewed={(viewed) => props.onToggleViewed(file.path, file.sha, viewed)}
        onCommentOnFile={() => {
          setCollapsed(false)
          setComposingFileComment(true)
        }}
      />

      {!collapsed && !near && <div style={{ height: bodyHeight.last ?? estimateBodyHeight(rows.length) }} />}
      {!collapsed && near && (
        <div ref={bodyHeight.ref}>
          {props.focus.length > 0 && (
            <div className="border-b border-line bg-focus/5 px-4 py-2 text-[12px]">
              {props.focus.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-mono text-focus">{f.lines || 'file'}</span>
                  <span className="text-muted">{f.reason}</span>
                </div>
              ))}
            </div>
          )}
          <FileComments
            path={file.path}
            threads={fileThreads}
            drafts={props.drafts}
            composing={composingFileComment}
            onCloseComposer={() => setComposingFileComment(false)}
            onAddDraft={props.onAddDraft}
            onUpdateDraft={props.onUpdateDraft}
            onDeleteDraft={props.onDeleteDraft}
            onReplyNow={props.onReplyNow}
          />
          {outdated.length > 0 && (
            <details className="border-b border-line px-4 py-2 text-[12px] text-muted">
              <summary className="cursor-pointer">{outdated.length} outdated comment thread(s)</summary>
              <div className="mt-2 space-y-2">
                {outdated.map((c) => (
                  <CommentView key={c.id} c={c} />
                ))}
              </div>
            </details>
          )}
          {!file.patch ? (
            <div className="px-4 py-6 text-center text-muted">Binary file or diff too large to display.</div>
          ) : view === 'unified' ? (
            <table onMouseUp={onMouseUp} className="w-full border-collapse font-mono text-[12px] leading-[20px]">
              <tbody>
                {rows.map((row, i) => {
                  if (row.kind === 'hunk') return hunkRow(row, i, 3)
                  const a = anchorFor(row)
                  const notes = annotations(keysOf(row), a)
                  return (
                    <RowGroup key={i}>
                      <tr onMouseEnter={() => dragOver(a)} data-new-line={row.newNo ?? undefined} className={cx('group', rowBg(row.kind), inSel(a) && '!bg-accent/20')}>
                        <Gutter kind={row.kind} focus={inFocus(row)} onDown={(shift) => pressGutter(a, shift)}>
                          <span className="inline-block w-8">{row.oldNo ?? ''}</span>
                          <span className="inline-block w-8">{row.newNo ?? ''}</span>
                        </Gutter>
                        <Sign kind={row.kind} />
                        <Code row={row} idx={i} tokens={tokens?.get(i)} />
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
          ) : (
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
                  if (sr.kind === 'hunk') return hunkRow(rows[sr.idx]!, i, 6)
                  const L = sr.left != null ? (rows[sr.left] as LineRow) : null
                  const R = sr.right != null ? (rows[sr.right] as LineRow) : null
                  const la = L ? anchorFor(L, 'LEFT') : null
                  const ra = R ? anchorFor(R, 'RIGHT') : null
                  const leftNotes = L ? annotations(keysOf(L, 'LEFT'), la) : null
                  const rightNotes = R ? annotations(keysOf(R, 'RIGHT'), ra) : null
                  return (
                    <RowGroup key={i}>
                      <tr data-new-line={R?.newNo ?? undefined}>
                        {L ? (
                          <Half row={L} idx={sr.left!} half="LEFT" lineNo={L.oldNo} tokens={tokens?.get(sr.left!)} selected={inSel(la)} focus={false} onDown={(shift) => pressGutter(la, shift)} onEnter={() => dragOver(la)} />
                        ) : (
                          <EmptyHalf />
                        )}
                        {R ? (
                          <Half row={R} idx={sr.right!} half="RIGHT" lineNo={R.newNo} tokens={tokens?.get(sr.right!)} selected={inSel(ra)} focus={inFocus(R)} onDown={(shift) => pressGutter(ra, shift)} onEnter={() => dragOver(ra)} divider />
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
          )}
        </div>
      )}
      {floating && (
        <button
          className="btn btn-primary fixed z-50 shadow-lg"
          style={{ left: floating.x + 8, top: floating.y + 10 }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            ask(floating.side, floating.start, floating.end)
            setFloating(null)
          }}
        >
          ✦ Ask Claude · {floating.start === floating.end ? `L${floating.end}` : `L${floating.start}–${floating.end}`}
        </button>
      )}
    </div>
  )
})


const ROW_HEIGHT = 20

/** Placeholder height for a diff body that has not rendered yet. */
function estimateBodyHeight(rowCount: number) {
  return rowCount ? rowCount * ROW_HEIGHT : 72
}

/** Tracks the rendered body's height so its placeholder keeps the same size after it unmounts. */
function useBodyHeight(mounted: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [last, setLast] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!mounted || !el) return
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry?.contentRect.height ?? 0)
      if (height) setLast((prev) => (prev === height ? prev : height))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [mounted])
  return { ref, last }
}
