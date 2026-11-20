import type { StackPrComments } from '@shared/inbox.types.ts'
import { isPresent } from '@shared/presence.util.ts'

/** A review thread as the stack comments query returns it: who wrote each comment, in order. */
export interface RawStackThread {
  isResolved: boolean
  comments: { nodes: ({ author: { login: string } | null } | null)[] }
}

/**
 * Counts your threads on one PR and the open ones waiting on you: someone else wrote the last comment after
 * yours. A thread you never commented in does not count, even if it mentions you.
 */
export function summarizeStackPr(
  pr: { repo: string; number: number },
  threads: readonly (RawStackThread | null)[],
  viewer: string,
): StackPrComments {
  let yourThreads = 0
  let awaitingYou = 0
  const authorsOf = (t: RawStackThread) => t.comments.nodes.map((c) => c?.author?.login ?? null)
  const yours = threads.filter(isPresent).filter((t) => authorsOf(t).includes(viewer))
  for (const t of yours) {
    const authors = authorsOf(t)
    yourThreads += 1
    const last = authors.at(-1)
    if (!t.isResolved && last !== viewer) {
      awaitingYou += 1
    }
  }
  return { repo: pr.repo, number: pr.number, yourThreads, awaitingYou }
}
