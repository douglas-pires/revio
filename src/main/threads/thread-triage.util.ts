import { isPresent } from '@shared/presence.util.ts'
import type { OpenThread, ThreadComment } from '@shared/thread.types.ts'

/** GitHub's GraphQL shapes for a PR and its review threads. */
/** The thread's line on the new side; none once the code it was on has changed. */
function readCurrentLine(thread: RawThread) {
  if (thread.isOutdated) {
    return null
  }
  return thread.line
}

/** Whose turn it is: yours when someone else spoke last, theirs when you did. */
function findWhoIsWaited(lastAuthor: string | undefined, viewer: string): OpenThread['waitingOn'] {
  if (lastAuthor === viewer) {
    return 'others'
  }
  return 'you'
}

interface RawAuthor {
  __typename: string
  login: string
  avatarUrl: string
}

export interface RawThreadComment {
  author: RawAuthor | null
  body: string
  createdAt: string
  url: string
}

export interface RawThread {
  id: string
  isResolved: boolean
  isOutdated: boolean
  path: string
  line: number | null
  comments: { totalCount: number; nodes: (RawThreadComment | null)[] }
}

export interface RawThreadPr {
  number: number
  title: string
  url: string
  isDraft: boolean
  repository: { nameWithOwner: string }
  author: RawAuthor | null
  reviewThreads: { nodes: (RawThread | null)[] }
}

/**
 * Keeps the unresolved threads you are part of (your PR, or you commented) and says who owes the next reply.
 * Only the latest comments are fetched, so taking part earlier in a very long thread may go unnoticed.
 */
export function triageThread(thread: RawThread, pr: RawThreadPr, viewer: string): OpenThread | null {
  if (thread.isResolved) {
    return null
  }
  const comments = thread.comments.nodes.filter((comment): comment is RawThreadComment => Boolean(comment))
  const last = comments.at(-1)
  if (!last) {
    return null
  }
  const yourPr = pr.author?.login === viewer
  const youCommented = comments.some((comment) => comment.author?.login === viewer)
  if (!(yourPr || youCommented)) {
    return null
  }
  return {
    id: thread.id,
    repo: pr.repository.nameWithOwner,
    number: pr.number,
    prTitle: pr.title,
    prUrl: pr.url,
    prAuthor: pr.author?.login ?? 'ghost',
    isDraft: pr.isDraft,
    path: thread.path,
    line: readCurrentLine(thread),
    outdated: thread.isOutdated,
    comments: comments.map(toThreadComment),
    totalComments: thread.comments.totalCount,
    waitingOn: findWhoIsWaited(last.author?.login, viewer),
    lastActivityAt: last.createdAt,
  }
}

/** Every open thread across the PRs, the longest-waiting first. */
export function triageThreads(prs: readonly RawThreadPr[], viewer: string): OpenThread[] {
  return prs
    .flatMap((pr) => pr.reviewThreads.nodes.filter(isPresent).map((thread) => triageThread(thread, pr, viewer)))
    .filter((thread): thread is OpenThread => Boolean(thread))
    .sort((left, right) => left.lastActivityAt.localeCompare(right.lastActivityAt))
}

export function toThreadComment(comment: RawThreadComment): ThreadComment {
  return {
    author: comment.author?.login ?? 'ghost',
    authorAvatar: comment.author?.avatarUrl ?? '',
    bot: comment.author?.__typename === 'Bot',
    body: comment.body,
    createdAt: comment.createdAt,
    url: comment.url,
  }
}
