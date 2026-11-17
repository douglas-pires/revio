import type { DiffSide, DraftComment, PullThreadStatus, ReviewComment } from '@shared/pull.types'
import { anchorKey } from './diff.util'

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
export function groupCommentThreads(comments: readonly ReviewComment[], statuses: readonly PullThreadStatus[], fileOrder: readonly string[]): CommentThread[] {
  const status = new Map(statuses.map((s) => [s.rootCommentId, s]))
  const ids = new Set(comments.map((c) => c.id))
  const isRoot = (c: ReviewComment) => !c.inReplyTo || !ids.has(c.inReplyTo)
  const replies = new Map<number, ReviewComment[]>()
  for (const c of comments) if (!isRoot(c)) replies.set(c.inReplyTo!, [...(replies.get(c.inReplyTo!) ?? []), c])

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
    .sort((a, b) => (fileRank.get(a.path) ?? Infinity) - (fileRank.get(b.path) ?? Infinity) || (a.line ?? Infinity) - (b.line ?? Infinity))
}

/** One file's comments and drafts, keyed by `anchorKey(side, line)` for the diff rows that show them. */
export interface FileCommentIndex {
  threadsByLine: Map<string, ReviewComment[][]>
  fileThreads: ReviewComment[][]
  /** First comments of threads whose line is gone from the diff. */
  outdated: ReviewComment[]
  /** New line comments; replies and file comments are shown elsewhere. */
  draftsByLine: Map<string, DraftComment[]>
}

export function indexFileComments(path: string, comments: readonly ReviewComment[], drafts: readonly DraftComment[]): FileCommentIndex {
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) ?? []), v])
  const index: FileCommentIndex = { threadsByLine: new Map(), fileThreads: [], outdated: [], draftsByLine: new Map() }
  for (const t of groupCommentThreads(comments, [], [path])) {
    if (t.onFile) index.fileThreads.push(t.comments)
    else if (t.outdated || t.line == null) index.outdated.push(t.comments[0]!)
    else push(index.threadsByLine, anchorKey(t.side, t.line), t.comments)
  }
  for (const d of drafts) if (!d.inReplyTo && d.line != null) push(index.draftsByLine, anchorKey(d.side, d.line), d)
  return index
}
