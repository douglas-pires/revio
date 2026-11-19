/** Keep this many screens; the oldest go first. */
const MAX_ENTRIES = 50

/** Back/forward history of screens, like a browser's: visiting from the middle drops the forward entries. */
export interface NavHistory<T> {
  entries: readonly T[]
  index: number
}

export const startHistory = <T>(first: T): NavHistory<T> => ({ entries: [first], index: 0 })

export function currentEntry<T>(h: NavHistory<T>): T {
  const entry = h.entries[h.index]
  // startHistory, visit and step keep the index on an entry; this only guards that promise.
  if (entry === undefined) {
    throw new Error('Navigation history lost its current screen')
  }
  return entry
}

export const canGoBack = <T>(h: NavHistory<T>) => h.index > 0

export const canGoForward = <T>(h: NavHistory<T>) => h.index < h.entries.length - 1

/** Adds a screen after the current one; visiting the screen you are on changes nothing. */
export function visit<T>(h: NavHistory<T>, entry: T, same: (a: T, b: T) => boolean): NavHistory<T> {
  if (same(currentEntry(h), entry)) {
    return h
  }
  const entries = [...h.entries.slice(0, h.index + 1), entry].slice(-MAX_ENTRIES)
  return { entries, index: entries.length - 1 }
}

/** Moves back (-1) or forward (+1) when there is somewhere to go. */
export function step<T>(h: NavHistory<T>, delta: -1 | 1): NavHistory<T> {
  const index = h.index + delta
  if (index < 0 || index >= h.entries.length) {
    return h
  }
  return { ...h, index }
}
