import { createContext, useContext } from 'react'

/**
 * What you typed in a comment box and did not send, by box (see `Composer`'s `unsentKey`). Escape, clicking away or
 * leaving the PR closes the box but keeps the text here, and the box shows it again when it reopens; only Cancel or
 * sending forgets it. Kept until Revio quits.
 */
const unsent = new Map<string, string>()

/** The text you left in this box, if any. */
export function readUnsentComment(key: string): string | undefined {
  return unsent.get(key)
}

/** Remembers `body` for this box, unless it is empty or still just what the box opened with. */
export function keepUnsentComment(key: string, body: string, initial: string) {
  if (body.trim() === '' || body === initial) {
    unsent.delete(key)
    return
  }
  unsent.set(key, body)
}

export function forgetUnsentComment(key: string) {
  unsent.delete(key)
}

/** The open PR (`owner/name#number`), so boxes keyed by file and line don't meet the same file in another PR. */
export const UnsentScopeContext = createContext('')

export const useUnsentScope = () => useContext(UnsentScopeContext)
