import type { AskThread } from '@shared/claude.types.ts'
import type { DraftComment } from '@shared/pull.types.ts'

/** The drafts with one draft's text replaced. */
export function withDraftBody(drafts: readonly DraftComment[], id: string, body: string): DraftComment[] {
  return drafts.map((d) => {
    if (d.id !== id) {
      return d
    }
    return { ...d, body }
  })
}

/** Viewed files after marking one viewed at `sha`, or not viewed (null). */
export function withViewed(viewed: Readonly<Record<string, string>>, path: string, sha: string | null) {
  const next = { ...viewed }
  if (sha === null) {
    delete next[path]
  } else {
    next[path] = sha
  }
  return next
}

/** Saved conversations with this one first; one with no questions yet is not kept. */
export function withSavedThread(asks: readonly AskThread[], thread: AskThread): AskThread[] {
  const others = asks.filter((x) => x.id !== thread.id)
  if (thread.messages.length === 0) {
    return others
  }
  return [thread, ...others]
}
