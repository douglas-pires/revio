import type {
  ConversationComment,
  DiffSide,
  DraftComment,
  PullThreadStatus,
  ReviewComment,
} from '@shared/pull.types.ts'
import { buildAnchorKey } from './diff.util.ts'

const includesFolded = (text: string, needle: string) => text.toLowerCase().includes(needle)

interface LineSpan {
  side: DiffSide
  line: number | null
  startLine?: number | null | undefined
}

/** The lines a comment covers: startLine..line on its side, or just its line. */
function listCoveredAnchors({ side, line, startLine }: LineSpan): string[] {
  if (line === null) {
    return []
  }
  const first = Math.min(startLine ?? line, line)
  return Array.from({ length: line - first + 1 }, (_, offset) => buildAnchorKey(side, first + offset))
}

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
  const status = new Map(statuses.map((threadStatus) => [threadStatus.rootCommentId, threadStatus]))
  const ids = new Set(comments.map((comment) => comment.id))
  const findParent = (comment: ReviewComment) => {
    if (comment.inReplyTo && ids.has(comment.inReplyTo)) {
      return comment.inReplyTo
    }
    return null
  }
  const isRoot = (comment: ReviewComment) => findParent(comment) === null
  const replies = new Map<number, ReviewComment[]>()
  for (const comment of comments) {
    const parent = findParent(comment)
    if (parent !== null) {
      replies.set(parent, [...(replies.get(parent) ?? []), comment])
    }
  }

  const fileRank = new Map(fileOrder.map((path, index) => [path, index]))
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
      comments: [
        root,
        ...(replies.get(root.id) ?? []).sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      ],
    }))
    .sort(
      (left, right) =>
        (fileRank.get(left.path) ?? Number.POSITIVE_INFINITY) -
          (fileRank.get(right.path) ?? Number.POSITIVE_INFINITY) ||
        (left.line ?? Number.POSITIVE_INFINITY) - (right.line ?? Number.POSITIVE_INFINITY),
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
  const push = <T>(groups: Map<string, T[]>, key: string, entry: T) =>
    groups.set(key, [...(groups.get(key) ?? []), entry])
  const index: FileCommentIndex = {
    threadsByLine: new Map(),
    fileThreads: [],
    outdatedThreads: [],
    draftsByLine: new Map(),
  }
  for (const thread of groupCommentThreads(comments, [], [path])) {
    if (thread.onFile) {
      index.fileThreads.push(thread.comments)
    } else if (thread.outdated || thread.line === null) {
      index.outdatedThreads.push(thread.comments)
    } else {
      push(index.threadsByLine, buildAnchorKey(thread.side, thread.line), thread.comments)
    }
  }
  for (const draft of drafts) {
    if (!draft.inReplyTo && draft.line !== null) {
      push(index.draftsByLine, buildAnchorKey(draft.side, draft.line), draft)
    }
  }
  return index
}

/**
 * Every line a comment is on, as `anchorKey`s: GitHub's comments that still point at a line, and your pending ones
 * (replies sit on their thread's lines already). So the diff can keep those lines marked after the selection is gone.
 */
export function collectCommentedLines(
  comments: readonly ReviewComment[],
  drafts: readonly DraftComment[],
): Set<string> {
  const onLines = comments.filter((comment) => !comment.outdated && comment.subjectType === 'line')
  const newDrafts = drafts.filter((draft) => !draft.inReplyTo)
  return new Set([...onLines, ...newDrafts].flatMap(listCoveredAnchors))
}

/** The thread's comment that matches `query` (text or author), or null. The file path matching counts as the first comment. */
export function findMatchingComment(thread: CommentThread, query: string): ReviewComment | null {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return thread.comments[0] ?? null
  }
  const byText = thread.comments.find(
    (comment) => includesFolded(comment.body, needle) || includesFolded(comment.author, needle),
  )
  if (byText) {
    return byText
  }
  // A match on the file path counts as the first comment.
  if (includesFolded(thread.path, needle)) {
    return thread.comments[0] ?? null
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
export function findNewComments(thread: CommentThread, { viewer, since }: ReviewedBy): ReviewComment[] {
  if (since === null) {
    return []
  }
  return thread.comments.filter((comment) => comment.author !== viewer && comment.createdAt > since)
}

/** Threads with a comment, author or file path matching `query`, resolved ones included. */
export function searchThreads(threads: readonly CommentThread[], query: string): CommentThread[] {
  return threads.filter((thread) => findMatchingComment(thread, query))
}

/** Your pending comments whose text or file path matches `query`. */
export function searchDrafts(drafts: readonly DraftComment[], query: string): DraftComment[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return [...drafts]
  }
  return drafts.filter((draft) => includesFolded(draft.body, needle) || includesFolded(draft.path, needle))
}

/** Conversation comments whose text or author matches `query`; all of them for an empty query. */
export function searchConversation(comments: readonly ConversationComment[], query: string): ConversationComment[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return [...comments]
  }
  return comments.filter((comment) => includesFolded(comment.body, needle) || includesFolded(comment.author, needle))
}
