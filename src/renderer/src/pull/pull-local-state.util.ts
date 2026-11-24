import type { AskThread } from '@shared/claude.types.ts'
import type { DraftComment } from '@shared/pull.types.ts'

/** The drafts with one draft's text replaced. */
export function updateDraftBody(drafts: readonly DraftComment[], id: string, body: string): DraftComment[] {
  return drafts.map((draft) => {
    if (draft.id !== id) {
      return draft
    }
    return { ...draft, body }
  })
}

/** Viewed files after marking one viewed at `sha`, or not viewed (null). */
export function setViewed(viewed: Readonly<Record<string, string>>, path: string, sha: string | null) {
  const { [path]: _previous, ...others } = viewed
  if (sha === null) {
    return others
  }
  // Last in the record, which keeps the order files were marked in.
  return { ...others, [path]: sha }
}

/** Saved conversations with this one first; one with no questions yet is not kept. */
export function saveThread(asks: readonly AskThread[], thread: AskThread): AskThread[] {
  const others = asks.filter((saved) => saved.id !== thread.id)
  if (thread.messages.length === 0) {
    return others
  }
  return [thread, ...others]
}
