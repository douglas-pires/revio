import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import type { LineSelection } from './use-line-selection.hook.ts'

/** Where a comment box sits, so what you left in it can be found again. */
export interface UnsentPlace {
  /** The PR, as `owner/name#number`. */
  scope: string
  /** The file commented on; none for a reply in the conversation. */
  path?: string | undefined
  /** The lines picked, for a new comment on lines. */
  selection?: LineSelection | undefined
}

/** What you typed in a comment box and did not send, and where that box is. */
interface UnsentComment {
  body: string
  place: UnsentPlace
}

/** A line comment you closed without sending: its box's key, its text and the lines it was on. */
export interface UnsentLineComment {
  key: string
  body: string
  selection: LineSelection
}

/**
 * What you typed in each comment box and did not send (see `Composer`'s `unsentKey`). Escape, clicking away or
 * leaving the PR closes the box but keeps the text here, and the box shows it again when it reopens; only Cancel or
 * sending forgets it. Kept until Revio quits.
 */
const unsent = new Map<string, UnsentComment>()
/** A copy the screen reads, renewed when a box closes: renewing it on every key press would redraw the whole diff. */
let published: ReadonlyMap<string, UnsentComment> = new Map()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const readPublished = () => published

/** The text you left in this box, if any. */
export function readUnsentComment(key: string): string | undefined {
  return unsent.get(key)?.body
}

/** Remembers `body` for this box, unless it is empty or still just what the box opened with. */
export function keepUnsentComment(key: string, comment: UnsentComment, initial: string) {
  if (comment.body.trim() === '' || comment.body === initial) {
    unsent.delete(key)
    return
  }
  unsent.set(key, comment)
}

/** Shows what closed boxes hold: call when a box closes. */
export function publishUnsentComments() {
  published = new Map(unsent)
  for (const listener of listeners) {
    listener()
  }
}

/** Throws the box's text away. */
export function forgetUnsentComment(key: string) {
  unsent.delete(key)
  publishUnsentComments()
}

/** The line comments left unsent on a file of a PR. */
export function listUnsentLineComments(scope: string, path: string): UnsentLineComment[] {
  return [...published].flatMap(([key, { body, place }]) => {
    if (place.scope !== scope || place.path !== path || !place.selection) {
      return []
    }
    return [{ key, body, selection: place.selection }]
  })
}

/** The files of a PR with something left unsent on them. */
export function listUnsentPaths(scope: string): Set<string> {
  const paths = [...published.values()].filter(({ place }) => place.scope === scope).map(({ place }) => place.path)
  return new Set(paths.filter((path) => path !== undefined))
}

/** The open PR (`owner/name#number`), so boxes keyed by file and line don't meet the same file in another PR. */
export const UnsentScopeContext = createContext('')

export const useUnsentScope = () => useContext(UnsentScopeContext)

/** The text left in a closed box, kept current. */
export function useUnsentComment(key: string): string | undefined {
  return useSyncExternalStore(subscribe, () => published.get(key)?.body)
}

/** `listUnsentLineComments` for the open PR, kept current. */
export function useUnsentLineComments(path: string): UnsentLineComment[] {
  const scope = useUnsentScope()
  const snapshot = useSyncExternalStore(subscribe, readPublished)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the list is read from the snapshot, which is module state.
  return useMemo(() => listUnsentLineComments(scope, path), [scope, path, snapshot])
}

/** `listUnsentPaths` for the open PR, kept current. */
export function useUnsentPaths(): Set<string> {
  const scope = useUnsentScope()
  const snapshot = useSyncExternalStore(subscribe, readPublished)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the set is read from the snapshot, which is module state.
  return useMemo(() => listUnsentPaths(scope), [scope, snapshot])
}
