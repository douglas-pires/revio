import type { DiffSide, DraftComment, PullThreadStatus, ReviewComment } from '@shared/pull.types.ts'
import { anchorKey } from './diff.util.ts'

const includesFolded = (text: string, q: string) => text.toLowerCase().includes(q)

/** A review thread on this PR: its first comment, the replies, and whether it is resolved. */
export interface CommentThread {
  rootId: number
  /** GraphQL id, when GitHub reported thread status. */
  threadId: string | null
  path: string
  line: number | null
  side: DiffSide
  outdated: boolean
  /** A comment on the whole file, with no line. */
  onFile: boolean
  resolved: boolean
  comments: ReviewComment[]
}

/** Groups replies under their first comment, ordered like the file list, then by line (outdated last). */
export function groupCommentThreads(
  comments: readonly ReviewComment[],
  statuses: readonly PullThreadStatus[],
  fileOrder: readonly string[],
): CommentThread[] {
  const status = new Map(statuses.map((s) => [s.rootCommentId, s]))
  const ids = new Set(comments.map((c) => c.id))
  const parentOf = (c: ReviewComment) => {
    if (c.inReplyTo && ids.has(c.inReplyTo)) {
      return c.inReplyTo
    }
    return null
  }
  const isRoot = (c: ReviewComment) => parentOf(c) === null
  const replies = new Map<number, ReviewComment[]>()
  for (const c of comments) {
    const parent = parentOf(c)
    if (parent !== null) {
      replies.set(parent, [...(replies.get(parent) ?? []), c])
    }
  }

  const fileRank = new Map(fileOrder.map((p, i) => [p, i]))
  return comments
    .filter(isRoot)
    .map((root) => ({
      rootId: root.id,
      threadId: status.get(root.id)?.id ?? null,
      path: root.path,
      line: root.line,
      side: root.side,
      outdated: root.outdated,
      onFile: root.subjectType === 'file',
      resolved: status.get(root.id)?.resolved ?? false,
      comments: [root, ...(replies.get(root.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt))],
    }))
    .sort(
      (a, b) =>
        (fileRank.get(a.path) ?? Number.POSITIVE_INFINITY) - (fileRank.get(b.path) ?? Number.POSITIVE_INFINITY) ||
        (a.line ?? Number.POSITIVE_INFINITY) - (b.line ?? Number.POSITIVE_INFINITY),
    )
}

/** One file's comments and drafts, keyed by `anchorKey(side, line)` for the diff rows that show them. */
export interface FileCommentIndex {
  threadsByLine: Map<string, ReviewComment[][]>
  fileThreads: ReviewComment[][]
  /** Threads whose line is gone from the diff. */
  outdatedThreads: ReviewComment[][]
  /** New line comments; replies and file comments are shown elsewhere. */
  draftsByLine: Map<string, DraftComment[]>
}

export function indexFileComments(
  path: string,
  comments: readonly ReviewComment[],
  drafts: readonly DraftComment[],
): FileCommentIndex {
  const push = <T>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) ?? []), v])
  const index: FileCommentIndex = {
    threadsByLine: new Map(),
    fileThreads: [],
    outdatedThreads: [],
    draftsByLine: new Map(),
  }
  for (const t of groupCommentThreads(comments, [], [path])) {
    if (t.onFile) {
      index.fileThreads.push(t.comments)
    } else if (t.outdated || t.line === null) {
      index.outdatedThreads.push(t.comments)
    } else {
      push(index.threadsByLine, anchorKey(t.side, t.line), t.comments)
    }
  }
  for (const d of drafts) {
    if (!d.inReplyTo && d.line !== null) {
      push(index.draftsByLine, anchorKey(d.side, d.line), d)
    }
  }
  return index
}

/** The thread's comment that matches `query` (text or author), or null. The file path matching counts as the first comment. */
export function matchingComment(t: CommentThread, query: string): ReviewComment | null {
  const q = query.trim().toLowerCase()
  if (!q) {
    return t.comments[0] ?? null
  }
  const byText = t.comments.find((c) => includesFolded(c.body, q) || includesFolded(c.author, q))
  if (byText) {
    return byText
  }
  // A match on the file path counts as the first comment.
  if (includesFolded(t.path, q)) {
    return t.comments[0] ?? null
  }
  return null
}

/** Who you are and when you last reviewed, to tell which comments are new to you. */
export interface ReviewedBy {
  viewer: string
  /** Null before your first review: then nothing is "new", it is all unread. */
  since: string | null
}

/** The thread's comments by others since your last review, oldest first. */
export function newComments(t: CommentThread, { viewer, since }: ReviewedBy): ReviewComment[] {
  if (since === null) {
    return []
  }
  return t.comments.filter((c) => c.author !== viewer && c.createdAt > since)
}

/** Threads with a comment, author or file path matching `query`, resolved ones included. */
export function searchThreads(threads: readonly CommentThread[], query: string): CommentThread[] {
  return threads.filter((t) => matchingComment(t, query))
}

/** Your pending comments whose text or file path matches `query`. */
export function searchDrafts(drafts: readonly DraftComment[], query: string): DraftComment[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    return [...drafts]
  }
  return drafts.filter((d) => includesFolded(d.body, q) || includesFolded(d.path, q))
}
