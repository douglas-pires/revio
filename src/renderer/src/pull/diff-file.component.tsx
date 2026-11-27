import type { FocusItem } from '@shared/claude.types.ts'
import type { BlameRange } from '@shared/history.types.ts'
import { findBlameAt } from '@shared/history.util.ts'
import { isPresent } from '@shared/presence.util.ts'
import type { DiffSide, DraftComment, PullFile } from '@shared/pull.types.ts'
import { memo, useContext, useMemo, useRef, useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { AskClaudeButton } from './ask-claude-button.component.tsx'
import { BlameNote } from './blame-note.component.tsx'
import { collectCommentedLines, type FileCommentIndex, indexFileComments } from './comment-threads.util.ts'
import { CommentableLinesContext } from './commentable-lines.context.ts'
import {
  buildAnchorKey,
  extractDiffSnippet,
  extractNewSideText,
  type LineRow,
  parsePatch,
  parseRange,
} from './diff.util.ts'
import type { AskSelection, DiffFileProps, DiffView } from './diff-file.types.ts'
import { findEditorLine, isInFocus } from './diff-file.util.ts'
import { DiffFileHeader } from './diff-file-header.component.tsx'
import type { DiffTableProps } from './diff-table.types.ts'
import { FileComments } from './file-comments.component.tsx'
import { FocusReasons, OutdatedComments } from './file-notes.component.tsx'
import type { CommentActions } from './review-comments.component.tsx'
import { SplitDiff } from './split-diff.component.tsx'
import { UnifiedDiff } from './unified-diff.component.tsx'
import { useBlame } from './use-blame.hook.ts'
import { estimateBodyHeight, useBodyHeight } from './use-body-height.hook.ts'
import { useExpandedContext } from './use-expanded-context.hook.ts'
import { useLineNotes } from './use-line-notes.hook.tsx'
import { useLineSelection } from './use-line-selection.hook.ts'
import { useNearViewport } from './use-near-viewport.hook.ts'
import { useRowTokens } from './use-row-tokens.hook.ts'
import { useTextSelectionAsk } from './use-text-selection-ask.hook.ts'

/** Blame notes on new-side lines, when blame is on and loaded. */
function buildBlameNoteRenderer(ranges: readonly BlameRange[] | null) {
  if (!ranges) {
    return
  }
  return (row: LineRow) => {
    if (row.kind === 'del' || row.newNo === null) {
      return null
    }
    const range = findBlameAt(ranges, row.newNo)
    return range && <BlameNote range={range} />
  }
}

/** The diff table for the chosen view, or a note when GitHub sent no diff. */
function DiffTable({ hasPatch, view, table }: { hasPatch: boolean; view: DiffView; table: DiffTableProps }) {
  if (!hasPatch) {
    return <div className="px-4 py-6 text-center text-muted">Binary file or diff too large to display.</div>
  }
  if (view === 'unified') {
    return <UnifiedDiff {...table} />
  }
  return <SplitDiff {...table} />
}

/** A file's expanded body: focus reasons, file-level and outdated comments, then the diff. */
function DiffFileBody(props: {
  file: PullFile
  view: DiffView
  focus: readonly FocusItem[]
  index: FileCommentIndex
  drafts: readonly DraftComment[]
  actions: CommentActions
  composingFileComment: boolean
  onOpenComposer: () => void
  onCloseComposer: () => void
  contextError: string | null
  table: DiffTableProps
}) {
  const { file } = props
  return (
    <>
      <FocusReasons focus={props.focus} />
      <FileComments
        path={file.path}
        threads={props.index.fileThreads}
        drafts={props.drafts}
        composing={props.composingFileComment}
        onOpenComposer={props.onOpenComposer}
        onCloseComposer={props.onCloseComposer}
        actions={props.actions}
      />
      <OutdatedComments
        path={file.path}
        threads={props.index.outdatedThreads}
        allDrafts={props.drafts}
        actions={props.actions}
      />
      {props.contextError !== null && (
        <div className="border-b border-line px-4 py-1.5 text-[12px] text-danger">
          Could not show more of the file: {props.contextError}
        </div>
      )}
      <DiffTable hasPatch={Boolean(file.patch)} view={props.view} table={props.table} />
    </>
  )
}

/** The comment actions as one stable object, so memoized children keep it across renders. */
function useCommentActions(props: CommentActions): CommentActions {
  const { onAddDraft, onUpdateDraft, onDeleteDraft, onReplyNow } = props
  return useMemo(
    () => ({ onAddDraft, onUpdateDraft, onDeleteDraft, onReplyNow }),
    [onAddDraft, onUpdateDraft, onDeleteDraft, onReplyNow],
  )
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: one file's diff wires together its hooks (viewport, rows, comments, selection, blame); each piece lives in its own module.
export const DiffFile = memo(function DiffFileView(props: DiffFileProps) {
  const { file, collapsed, view } = props
  const setCollapsed = (value: boolean) => props.onToggleCollapsed(file.path, value)
  const patchRows = useMemo(() => parsePatch(file.patch ?? ''), [file.patch])
  // Added and removed files are whole in the diff; there is nothing around them to show.
  const canExpand = file.status !== 'added' && file.status !== 'removed'
  const context = useExpandedContext({ repo: props.repo, sha: props.headSha, path: file.path }, patchRows, canExpand)
  const { rows } = context
  const canComment = useContext(CommentableLinesContext)
  const selection = useLineSelection((anchor) => canComment?.(file.path, anchor.side, anchor.line) ?? true)
  const textAsk = useTextSelectionAsk(rows)
  const [composingFileComment, setComposingFileComment] = useState(false)

  // Only files near the visible area render their diff body; the rest keep a same-height placeholder.
  const container = useRef<HTMLDivElement>(null)
  const [focusWithin, setFocusWithin] = useState(false)
  // Never unmount a body the reviewer is working in (selection or a focused comment box).
  const near = useNearViewport(container, selection.sel !== null || focusWithin)
  const open = near && !collapsed
  const bodyHeight = useBodyHeight(open)
  const tokens = useRowTokens(file.path, file.patch, rows, open)
  const blame = useBlame(
    { repo: props.repo, sha: props.headSha, path: file.path },
    props.blame && open && file.status !== 'removed',
  )
  const actions = useCommentActions(props)
  const focusRanges = useMemo(
    () => props.focus.map((focusItem) => parseRange(focusItem.lines)).filter(isPresent),
    [props.focus],
  )
  const index = useMemo(
    () => indexFileComments(file.path, props.comments, props.drafts),
    [file.path, props.comments, props.drafts],
  )
  const commented = useMemo(() => collectCommentedLines(props.comments, props.drafts), [props.comments, props.drafts])
  const buildSelection = (side: DiffSide, start: number, end: number): AskSelection => ({
    path: file.path,
    side,
    startLine: start,
    endLine: end,
    snippet: extractDiffSnippet(rows, side, start, end),
  })
  const ask = (side: DiffSide, start: number, end: number) => props.onAsk(buildSelection(side, start, end))
  const { onAddToChat } = props
  let addToChat: ((sel: { side: DiffSide; start: number; end: number }) => void) | undefined
  if (onAddToChat) {
    addToChat = (lineSelection) =>
      onAddToChat(buildSelection(lineSelection.side, lineSelection.start, lineSelection.end))
  }
  const notesFor = useLineNotes({
    path: file.path,
    index,
    allDrafts: props.drafts,
    selection,
    actions,
    newSideText: (start, end) => extractNewSideText(rows, start, end),
    onAsk: (lineSelection) => ask(lineSelection.side, lineSelection.start, lineSelection.end),
    onAddToChat: addToChat,
  })

  const table: DiffTableProps = {
    rows,
    tokens,
    selection,
    inFocus: (row) => isInFocus(row, focusRanges),
    commented: (anchor) => anchor !== null && commented.has(buildAnchorKey(anchor.side, anchor.line)),
    notesFor,
    onMouseUp: textAsk.onMouseUp,
  }
  if (canExpand) {
    table.onExpand = context.expand
  }
  let blameError: string | null = null
  if (props.blame) {
    blameError = blame.error
    table.noteFor = buildBlameNoteRenderer(blame.ranges)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focus and blur only track whether a comment box inside is in use.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same; the handlers observe focus, they do not make the element a control.
    <div
      ref={container}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && setFocusWithin(false)}
      id={`file-${file.path}`}
      // overflow-clip, not overflow-hidden: it rounds the corners without becoming a scroll box, so the header stays sticky.
      className={joinClassNames(
        'scroll-mt-2 overflow-clip rounded-lg border bg-panel',
        props.current && 'border-accent ring-1 ring-accent/40',
        !props.current && 'border-line',
      )}
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
        onShowHistory={() => props.onShowHistory(file.path)}
        onOpenInEditor={() =>
          globalThis.revio.openInEditor({
            repo: props.repo,
            path: file.path,
            line: findEditorLine(selection.sel, patchRows),
          })
        }
        blameError={blameError}
        onCommentOnFile={() => {
          setCollapsed(false)
          setComposingFileComment(true)
        }}
      />

      {!(collapsed || near) && (
        // biome-ignore lint/style/noInlineStyles: the placeholder keeps the height of the diff it stands in for.
        <div style={{ height: bodyHeight.last ?? estimateBodyHeight(rows.length) }} />
      )}
      {Boolean(open) && (
        <div ref={bodyHeight.ref}>
          <DiffFileBody
            file={file}
            view={view}
            focus={props.focus}
            index={index}
            drafts={props.drafts}
            actions={actions}
            composingFileComment={composingFileComment}
            onOpenComposer={() => setComposingFileComment(true)}
            onCloseComposer={() => setComposingFileComment(false)}
            contextError={context.error}
            table={table}
          />
        </div>
      )}
      {textAsk.floating !== null && (
        <AskClaudeButton
          at={textAsk.floating}
          onAsk={() => {
            const at = textAsk.floating
            if (at) {
              ask(at.side, at.start, at.end)
            }
            textAsk.dismiss()
          }}
        />
      )}
    </div>
  )
})
