import { createContext, useCallback, useContext, useMemo, useState } from 'react'

interface FoldState {
  all: boolean
  /** Threads (by first comment id) set the other way from `all`. */
  flipped: ReadonlySet<number>
  /** Comments jumped to: their threads stay open. */
  revealed: ReadonlySet<number>
}

const EMPTY_SET: ReadonlySet<number> = new Set()
const withAdded = (set: ReadonlySet<number>, id: number) => new Set([...set, id])
const without = (set: ReadonlySet<number>, ids: readonly number[]) =>
  new Set([...set].filter((id) => !ids.includes(id)))

/**
 * Which review threads in the diff are minimised to one line. Kept for the whole PR, not in each thread, because a
 * file's diff unmounts when it scrolls far away and would forget.
 */
export interface ThreadFold {
  /** Every thread minimised, apart from the ones you opened since. */
  all: boolean
  setAll: (all: boolean) => void
  /** Whether the thread with these comment ids (first comment first) is minimised. */
  isFolded: (ids: readonly number[]) => boolean
  setFolded: (ids: readonly number[], folded: boolean) => void
  /** Opens the thread holding this comment, e.g. when jumping to it from the comments panel. */
  reveal: (commentId: number) => void
}

/** Whether a thread is minimised: the overall choice, unless set otherwise or jumped to. */
export function threadFolded(state: FoldState, ids: readonly number[]): boolean {
  const [root] = ids
  if (root === undefined || ids.some((id) => state.revealed.has(id))) {
    return false
  }
  return state.all !== state.flipped.has(root)
}

/** The state after you minimise or open one thread. */
export function withThreadFolded(state: FoldState, ids: readonly number[], folded: boolean): FoldState {
  const [root] = ids
  if (root === undefined) {
    return state
  }
  const flipped = without(state.flipped, [root])
  if (folded !== state.all) {
    flipped.add(root)
  }
  return { all: state.all, flipped, revealed: without(state.revealed, ids) }
}

export function useThreadFoldState(): ThreadFold {
  const [state, setState] = useState<FoldState>({ all: false, flipped: EMPTY_SET, revealed: EMPTY_SET })
  const setAll = useCallback((all: boolean) => setState({ all, flipped: EMPTY_SET, revealed: EMPTY_SET }), [])
  const setFolded = useCallback(
    (ids: readonly number[], folded: boolean) => setState((s) => withThreadFolded(s, ids, folded)),
    [],
  )
  const reveal = useCallback((id: number) => setState((s) => ({ ...s, revealed: withAdded(s.revealed, id) })), [])
  return useMemo(
    () => ({ all: state.all, setAll, isFolded: (ids) => threadFolded(state, ids), setFolded, reveal }),
    [state, setAll, setFolded, reveal],
  )
}

/** Provided by the PR view; elsewhere (the Threads screen) threads are never minimised. */
export const ThreadFoldContext = createContext<ThreadFold | null>(null)

export const useThreadFold = () => useContext(ThreadFoldContext)
