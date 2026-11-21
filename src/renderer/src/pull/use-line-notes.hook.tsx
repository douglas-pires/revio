import type { DraftComment } from '@shared/pull.types.ts'
import type { FileCommentIndex } from './comment-threads.util.ts'
import { buildDraftFromSelection, describeRange } from './diff-file.util.ts'
import { type ComposerSpec, LineAnnotations } from './line-annotations.component.tsx'
import type { CommentActions } from './review-comments.component.tsx'
import { useUnsentScope } from './unsent-comments.util.ts'
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
  /** Set while a Claude chat is open: adds the selection to it. */
  onAddToChat?: ((sel: { side: Anchor['side']; start: number; end: number }) => void) | undefined
}

/**
 * The notes under each diff line: its threads, its drafts, and the comment box when the selection ends there.
 * Returns the `notesFor(keys, anchor)` the diff tables call for every row.
 */
export function useLineNotes(input: LineNotesInput) {
  const { path, index, selection } = input
  const scope = useUnsentScope()
  const findComposer = (anchor: Anchor | null): ComposerSpec | null => {
    const { sel } = selection
    if (!(sel && selection.composerAt(anchor))) {
      return null
    }
    const spec: ComposerSpec = {
      label: describeRange(sel),
      // By the line the box opens under, not the whole range: select up to the same line again and your text is back.
      unsentKey: `${scope}:line:${path}:${sel.side}:${sel.end}`,
      onCancel: selection.clear,
      onAsk: () => {
        input.onAsk(sel)
        selection.clear()
      },
      onSubmit: (body) => {
        input.actions.onAddDraft(buildDraftFromSelection(path, sel, body))
        selection.clear()
      },
    }
    if (sel.side === 'RIGHT') {
      spec.suggestion = input.newSideText(sel.start, sel.end)
    }
    const { onAddToChat } = input
    if (onAddToChat) {
      spec.onAddToChat = () => {
        onAddToChat(sel)
        selection.clear()
      }
    }
    return spec
  }
  return (keys: string[], anchor: Anchor | null) => {
    const threads = keys.flatMap((key) => index.threadsByLine.get(key) ?? [])
    const drafts = keys.flatMap((key) => index.draftsByLine.get(key) ?? [])
    const composer = findComposer(anchor)
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
