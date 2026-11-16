import type { OpenThread, ThreadComment } from '@shared/types'

/** GitHub's GraphQL shapes for a PR and its review threads. */
export interface RawAuthor {
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
  if (thread.isResolved) return null
  const comments = thread.comments.nodes.filter((c): c is RawThreadComment => !!c)
  const last = comments.at(-1)
  if (!last) return null
  const yourPr = pr.author?.login === viewer
  const youCommented = comments.some((c) => c.author?.login === viewer)
  if (!yourPr && !youCommented) return null
  return {
    id: thread.id,
    repo: pr.repository.nameWithOwner,
    number: pr.number,
    prTitle: pr.title,
    prUrl: pr.url,
    prAuthor: pr.author?.login ?? 'ghost',
    isDraft: pr.isDraft,
    path: thread.path,
    line: thread.isOutdated ? null : thread.line,
    outdated: thread.isOutdated,
    comments: comments.map(toThreadComment),
    totalComments: thread.comments.totalCount,
    waitingOn: last.author?.login === viewer ? 'others' : 'you',
    lastActivityAt: last.createdAt,
  }
}

/** Every open thread across the PRs, the longest-waiting first. */
export function triageThreads(prs: readonly RawThreadPr[], viewer: string): OpenThread[] {
  return prs
    .flatMap((pr) => pr.reviewThreads.nodes.flatMap((t) => (t ? [triageThread(t, pr, viewer)] : [])))
    .filter((t): t is OpenThread => !!t)
    .sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt))
}

export function toThreadComment(c: RawThreadComment): ThreadComment {
  return {
    author: c.author?.login ?? 'ghost',
    authorAvatar: c.author?.avatarUrl ?? '',
    bot: c.author?.__typename === 'Bot',
    body: c.body,
    createdAt: c.createdAt,
    url: c.url,
  }
}
