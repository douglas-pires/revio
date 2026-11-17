import { memo, useMemo, useRef, useState } from 'react'
import type { FocusItem } from '@shared/claude.types'
import type { DiffSide, DraftComment, PullFile, ReviewComment } from '@shared/pull.types'
import { diffSnippet, newSideText, parsePatch, parseRange, type DiffRow } from './diff.util'
import { cx } from '../common/format.util'
import { useNearViewport } from './use-near-viewport.hook'
import { indexFileComments } from './comment-threads.util'
import { DiffFileHeader } from './diff-file-header.component'
import { FileComments } from './file-comments.component'
import { FocusReasons, OutdatedComments } from './file-notes.component'
import { LineAnnotations, type ComposerSpec } from './line-annotations.component'
import { UnifiedDiff } from './unified-diff.component'
import { SplitDiff } from './split-diff.component'
import { AskClaudeButton } from './ask-claude-button.component'
import { useLineSelection, type Anchor, type LineSelection } from './use-line-selection.hook'
import { useTextSelectionAsk } from './use-text-selection-ask.hook'
import { useRowTokens } from './use-row-tokens.hook'
import { estimateBodyHeight, useBodyHeight } from './use-body-height.hook'
import type { DiffTableProps } from './diff-table.types'

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

const rangeLabel = (s: LineSelection) => `${s.side === 'LEFT' ? 'Old line' : 'Line'}${s.start === s.end ? ` ${s.end}` : `s ${s.start}–${s.end}`}`

export const DiffFile = memo(function DiffFile(props: DiffFileProps) {
  const { file, collapsed, view } = props
  const setCollapsed = (value: boolean) => props.onToggleCollapsed(file.path, value)
  const rows = useMemo(() => (file.patch ? parsePatch(file.patch) : []), [file.patch])
  const selection = useLineSelection()
  const textAsk = useTextSelectionAsk(rows)
  const [composingFileComment, setComposingFileComment] = useState(false)

  // Only files near the visible area render their diff body; the rest keep a same-height placeholder.
  const container = useRef<HTMLDivElement>(null)
  const [focusWithin, setFocusWithin] = useState(false)
  // Never unmount a body the reviewer is working in (selection or a focused comment box).
  const near = useNearViewport(container, !!selection.sel || focusWithin)
  const bodyHeight = useBodyHeight(near && !collapsed)
  const tokens = useRowTokens(file.path, file.patch, rows, near && !collapsed)

  const focusRanges = useMemo(() => props.focus.map((f) => parseRange(f.lines)).filter((r) => r != null), [props.focus])
  const index = useMemo(() => indexFileComments(file.path, props.comments, props.drafts), [file.path, props.comments, props.drafts])

  const inFocus = (row: DiffRow) => row.kind !== 'hunk' && row.newNo != null && focusRanges.some(([a, b]) => row.newNo! >= a && row.newNo! <= b)
  const ask = (side: DiffSide, start: number, end: number) =>
    props.onAsk({ path: file.path, side, startLine: start, endLine: end, snippet: diffSnippet(rows, side, start, end) })

  const composerFor = (sel: LineSelection): ComposerSpec => ({
    label: rangeLabel(sel),
    suggestion: sel.side === 'RIGHT' ? newSideText(rows, sel.start, sel.end) : undefined,
    onCancel: selection.clear,
    onAsk: () => {
      ask(sel.side, sel.start, sel.end)
      selection.clear()
    },
    onSubmit: (body) => {
      props.onAddDraft({ path: file.path, side: sel.side, line: sel.end, startLine: sel.start !== sel.end ? sel.start : undefined, body })
      selection.clear()
    },
  })

  const notesFor = (keys: string[], anchor: Anchor | null) => {
    const threads = keys.flatMap((k) => index.threadsByLine.get(k) ?? [])
    const drafts = keys.flatMap((k) => index.draftsByLine.get(k) ?? [])
    const composer = selection.sel && selection.composerAt(anchor) ? composerFor(selection.sel) : null
    if (!threads.length && !drafts.length && !composer) return null
    return (
      <LineAnnotations
        path={file.path}
        threads={threads}
        drafts={drafts}
        allDrafts={props.drafts}
        composer={composer}
        onAddDraft={props.onAddDraft}
        onUpdateDraft={props.onUpdateDraft}
        onDeleteDraft={props.onDeleteDraft}
        onReplyNow={props.onReplyNow}
      />
    )
  }

  const table: DiffTableProps = { rows, tokens, selection, inFocus, notesFor, onMouseUp: textAsk.onMouseUp }

  return (
    <div
      ref={container}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocusWithin(false)}
      id={`file-${file.path}`}
      className={cx('scroll-mt-2 overflow-hidden rounded-lg border bg-panel', props.current ? 'border-accent ring-1 ring-accent/40' : 'border-line')}
    >
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
          <FocusReasons focus={props.focus} />
          <FileComments
            path={file.path}
            threads={index.fileThreads}
            drafts={props.drafts}
            composing={composingFileComment}
            onCloseComposer={() => setComposingFileComment(false)}
            onAddDraft={props.onAddDraft}
            onUpdateDraft={props.onUpdateDraft}
            onDeleteDraft={props.onDeleteDraft}
            onReplyNow={props.onReplyNow}
          />
          <OutdatedComments comments={index.outdated} />
          {!file.patch ? (
            <div className="px-4 py-6 text-center text-muted">Binary file or diff too large to display.</div>
          ) : view === 'unified' ? (
            <UnifiedDiff {...table} />
          ) : (
            <SplitDiff {...table} />
          )}
        </div>
      )}
      {textAsk.floating && (
        <AskClaudeButton
          at={textAsk.floating}
          onAsk={() => {
            const f = textAsk.floating!
            ask(f.side, f.start, f.end)
            textAsk.dismiss()
          }}
        />
      )}
    </div>
  )
})
