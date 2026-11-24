import type { DraftComment } from '@shared/pull.types.ts'
import type { FileCommentIndex } from './comment-threads.util.ts'
import { buildAnchorKey } from './diff.util.ts'
import { buildDraftFromSelection, describeRange } from './diff-file.util.ts'
import { type ComposerSpec, LineAnnotations } from './line-annotations.component.tsx'
import type { CommentActions } from './review-comments.component.tsx'
import { type UnsentLineComment, useUnsentLineComments, useUnsentScope } from './unsent-comments.util.ts'
import type { Anchor, LineSelection, LineSelectionApi } from './use-line-selection.hook.ts'

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

/** Names the box that opens under the selection by its last line: select up to it again and your text is back. */
function buildUnsentKey(scope: string, path: string, selection: LineSelection) {
  return `${scope}:line:${path}:${selection.side}:${selection.end}`
}

/** The unsent comments of a row, leaving out the one whose box is open. */
function findUnsent(unsent: readonly UnsentLineComment[], keys: readonly string[], openKey: string | undefined) {
  return unsent.filter(
    ({ key, selection }) => key !== openKey && keys.includes(buildAnchorKey(selection.side, selection.end)),
  )
}

/**
 * The notes under each diff line: its threads, its drafts, comments closed without sending, and the comment box when the selection ends there.
 * Returns the `notesFor(keys)` the diff tables call for every row.
 */
export function useLineNotes(input: LineNotesInput) {
  const { path, index, selection } = input
  const scope = useUnsentScope()
  const unsentComments = useUnsentLineComments(path)
  const findComposer = (keys: readonly string[]): ComposerSpec | null => {
    const { sel: lineSelection } = selection
    if (!(lineSelection && selection.composerAt(keys))) {
      return null
    }
    const spec: ComposerSpec = {
      label: describeRange(lineSelection),
      unsentKey: buildUnsentKey(scope, path, lineSelection),
      unsentSelection: lineSelection,
      onCancel: selection.clear,
      onAsk: () => {
        input.onAsk(lineSelection)
        selection.clear()
      },
      onSubmit: (body) => {
        input.actions.onAddDraft(buildDraftFromSelection(path, lineSelection, body))
        selection.clear()
      },
    }
    if (lineSelection.side === 'RIGHT') {
      spec.suggestion = input.newSideText(lineSelection.start, lineSelection.end)
    }
    const { onAddToChat } = input
    if (onAddToChat) {
      spec.onAddToChat = () => {
        onAddToChat(lineSelection)
        selection.clear()
      }
    }
    return spec
  }
  return (keys: string[]) => {
    const threads = keys.flatMap((key) => index.threadsByLine.get(key) ?? [])
    const drafts = keys.flatMap((key) => index.draftsByLine.get(key) ?? [])
    const composer = findComposer(keys)
    const unsent = findUnsent(unsentComments, keys, composer?.unsentKey)
    if (threads.length + drafts.length + unsent.length === 0 && composer === null) {
      return null
    }
    return (
      <LineAnnotations
        path={path}
        threads={threads}
        drafts={drafts}
        allDrafts={input.allDrafts}
        composer={composer}
        unsent={unsent}
        onContinueUnsent={selection.select}
        actions={input.actions}
      />
    )
  }
}
