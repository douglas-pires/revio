import type { DraftComment } from '@shared/pull.types.ts'
import type { FileCommentIndex } from './comment-threads.util.ts'
import { draftFromSelection, rangeLabel } from './diff-file.util.ts'
import { type ComposerSpec, LineAnnotations } from './line-annotations.component.tsx'
import type { CommentActions } from './review-comments.component.tsx'
import type { Anchor, LineSelectionApi } from './use-line-selection.hook.ts'

/** What a line's notes need: the file's comments, the line selection, and what a new comment can do. */
interface LineNotesInput {
  path: string
  index: FileCommentIndex
  allDrafts: readonly DraftComment[]
  selection: LineSelectionApi
  actions: CommentActions
  /** The new-side text of lines start..end, to prefill a suggestion. */
  newSideText: (start: number, end: number) => string
  onAsk: (sel: { side: Anchor['side']; start: number; end: number }) => void
}

/**
 * The notes under each diff line: its threads, its drafts, and the comment box when the selection ends there.
 * Returns the `notesFor(keys, anchor)` the diff tables call for every row.
 */
export function useLineNotes(input: LineNotesInput) {
  const { path, index, selection } = input
  const composerFor = (anchor: Anchor | null): ComposerSpec | null => {
    const { sel } = selection
    if (!(sel && selection.composerAt(anchor))) {
      return null
    }
    const spec: ComposerSpec = {
      label: rangeLabel(sel),
      onCancel: selection.clear,
      onAsk: () => {
        input.onAsk(sel)
        selection.clear()
      },
      onSubmit: (body) => {
        input.actions.onAddDraft(draftFromSelection(path, sel, body))
        selection.clear()
      },
    }
    if (sel.side === 'RIGHT') {
      spec.suggestion = input.newSideText(sel.start, sel.end)
    }
    return spec
  }
  return (keys: string[], anchor: Anchor | null) => {
    const threads = keys.flatMap((k) => index.threadsByLine.get(k) ?? [])
    const drafts = keys.flatMap((k) => index.draftsByLine.get(k) ?? [])
    const composer = composerFor(anchor)
    if (threads.length === 0 && drafts.length === 0 && composer === null) {
      return null
    }
    return (
      <LineAnnotations
        path={path}
        threads={threads}
        drafts={drafts}
        allDrafts={input.allDrafts}
        composer={composer}
        actions={input.actions}
      />
    )
  }
}
