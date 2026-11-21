import type { DraftComment } from '@shared/pull.types.ts'
import { type CommentThread, findNewComments, type ReviewedBy, searchThreads } from './comment-threads.util.ts'

/** The line to jump to: only new-side lines can be scrolled to in the diff. */
export function readNewSideLine(side: DraftComment['side'], line: number | null) {
  if (side !== 'RIGHT') {
    return null
  }
  return line
}

/** Resolved, with nothing new since your last review: hidden until you ask for resolved threads. */
export function isSettled(thread: CommentThread, reviewed: ReviewedBy) {
  return thread.resolved && findNewComments(thread, reviewed).length === 0
}

/**
 * A search looks through resolved threads too. Otherwise a resolved thread shows only when asked, unless someone
 * commented on it since your last review (the author's "fixed" as they resolve it, say).
 */
export function filterVisibleThreads(
  threads: readonly CommentThread[],
  query: string,
  showResolved: boolean,
  reviewed: ReviewedBy,
) {
  if (query.trim()) {
    return searchThreads(threads, query)
  }
  if (showResolved) {
    return threads
  }
  return threads.filter((thread) => !isSettled(thread, reviewed))
}

/** Whether you commented in the thread. */
export function hasYourComment(thread: CommentThread, viewer: string) {
  return thread.comments.some((comment) => comment.author === viewer)
}

/** Only your threads when `onlyYours` is on; every thread otherwise. */
export function keepYourThreads(threads: readonly CommentThread[], onlyYours: boolean, viewer: string) {
  if (!onlyYours) {
    return threads
  }
  return threads.filter((thread) => hasYourComment(thread, viewer))
}

/** How many entries matched, shown only while searching; null otherwise. */
export function countMatchesShown(searching: boolean, count: number) {
  if (!searching) {
    return null
  }
  return count
}

/** What the panel says when it lists nothing: why, given the search, the filter and the threads there are. */
export function describeEmptyList(query: string, threadCount: number, onlyYours: boolean) {
  if (onlyYours && !query.trim()) {
    return 'You have no comments on this PR yet.'
  }
  if (query.trim()) {
    return `No comment mentions “${query.trim()}”.`
  }
  if (threadCount > 0) {
    return 'Every thread is resolved.'
  }
  return 'No review comments yet.'
}
