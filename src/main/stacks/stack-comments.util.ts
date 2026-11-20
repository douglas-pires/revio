import type { StackPrComments } from '@shared/inbox.types.ts'
import { isPresent } from '@shared/presence.util.ts'
import type { PullRef } from '@shared/pull.types.ts'

/** Who wrote each comment of the thread, in order; null for a deleted account. */
function listCommentAuthors(thread: RawStackThread): (string | null)[] {
  return thread.comments.nodes.map((comment) => comment?.author?.login ?? null)
}

/** An open thread whose last comment is someone else's, after one of yours: an answer waits on you. */
function isAwaitingYou(thread: RawStackThread, viewer: string) {
  return !thread.isResolved && listCommentAuthors(thread).at(-1) !== viewer
}

/** A review thread as the stack comments query returns it: who wrote each comment, in order. */
export interface RawStackThread {
  isResolved: boolean
  comments: { nodes: ({ author: { login: string } | null } | null)[] }
}

/**
 * Counts your threads on one PR and the open ones waiting on you: someone else wrote the last comment after
 * yours. A thread you never commented in does not count, even if it mentions you.
 */
export function summarizeYourThreads(
  pull: PullRef,
  threads: readonly (RawStackThread | null)[],
  viewer: string,
): StackPrComments {
  const yourThreads = threads.filter(isPresent).filter((thread) => listCommentAuthors(thread).includes(viewer))
  return {
    repo: pull.repo,
    number: pull.number,
    yourThreads: yourThreads.length,
    awaitingYou: yourThreads.filter((thread) => isAwaitingYou(thread, viewer)).length,
  }
}
