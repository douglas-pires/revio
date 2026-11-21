import { excerptAround } from '@shared/excerpt.util.ts'
import type { ReviewComment } from '@shared/pull.types.ts'
import { countOf, formatAge, joinClassNames } from '../common/format.util.ts'
import { MatchText } from '../common/match-text.component.tsx'
import { type CommentThread, findMatchingComment, findNewComments, type ReviewedBy } from './comment-threads.util.ts'
import { readNewSideLine } from './comments-panel.util.ts'

/** Characters of a comment shown in the panel, around a search match when there is one. */
const EXCERPT_CHARS = 200
const AVATAR_PX = 20

/** The line a thread jumps to; none once its code has changed (outdated) or when it is on the old side. */
function findJumpLine(thread: CommentThread) {
  if (thread.outdated) {
    return null
  }
  return readNewSideLine(thread.side, thread.line)
}

/** The tooltip: where clicking goes, or why it can't go to the line. */
function describeJump(thread: CommentThread) {
  if (thread.outdated) {
    return 'The code this thread was on has changed since'
  }
  return `Go to line ${thread.line}`
}

/** Where the thread sits: "file", "outdated" or "L12". */
function describeThreadLine(thread: CommentThread) {
  if (thread.onFile) {
    return 'file'
  }
  if (thread.outdated || thread.line === null) {
    return 'outdated'
  }
  return `L${thread.line}`
}

/**
 * The comment a thread previews: the search match, else the first one. The thread always reads as the comment
 * that opened it, so your own comments stay findable once someone replies; new replies show beneath it.
 */
function pickPreviewedComment(thread: CommentThread, query: string) {
  if (query.trim()) {
    return findMatchingComment(thread, query)
  }
  return thread.comments[0] ?? null
}

/** The newest reply since your last review, shown under the thread's first comment. Null when searching. */
function findNewestReplyToShow(newSinceReview: readonly ReviewComment[], previewed: ReviewComment, query: string) {
  const newestReply = newSinceReview.at(-1)
  if (query.trim() || !newestReply || newestReply.id === previewed.id) {
    return null
  }
  return newestReply
}

/** A new reply quoted under the thread's first comment: its author and the start of its text. */
function NewestReply({ reply }: { reply: ReviewComment | null }) {
  if (!reply) {
    return null
  }
  return (
    <div className="mt-1 border-l-2 border-accent/40 pl-1.5 text-[11.5px]">
      <span className="font-medium">{reply.author}</span>{' '}
      <span className="line-clamp-2 text-muted">{excerptAround(reply.body, '', EXCERPT_CHARS)}</span>
    </div>
  )
}

/** The thread's author line: who wrote the previewed comment, where, what is new, and when it last moved. */
function ThreadHeading(props: {
  thread: CommentThread
  shown: ReviewComment
  last: ReviewComment
  newCount: number
  query: string
}) {
  const { thread } = props
  return (
    <div className="flex items-center gap-1.5">
      <span className="truncate font-medium">
        <MatchText text={props.shown.author} query={props.query} />
      </span>
      <span className="shrink-0 font-mono text-[10.5px] text-muted">{describeThreadLine(thread)}</span>
      {props.newCount > 0 && (
        <span className="chip bg-accent/15 py-0 text-[10px] text-accent" title="Since your last review">
          {props.newCount} new
        </span>
      )}
      {Boolean(thread.resolved) && <span className="chip bg-ok/15 py-0 text-[10px] text-ok">resolved</span>}
      <span className="ml-auto shrink-0 text-[10.5px] text-muted">{formatAge(props.last.createdAt)}</span>
    </div>
  )
}

/** Goes to a file, line and (optionally) a comment in the diff. */
export type JumpTo = (path: string, line: number | null, commentId?: number) => void

/** One review thread in the comments panel. Click to jump to it in the diff (its newest reply, when there is one). */
export function CommentThreadItem({
  thread,
  query,
  reviewed,
  onJump,
}: {
  thread: CommentThread
  query: string
  reviewed: ReviewedBy
  onJump: JumpTo
}) {
  const [root, ...replies] = thread.comments
  if (!root) {
    return null
  }
  const last = replies.at(-1) ?? root
  const newSinceReview = findNewComments(thread, reviewed)
  const shown = pickPreviewedComment(thread, query) ?? root
  const newestReply = findNewestReplyToShow(newSinceReview, shown, query)
  return (
    <button
      type="button"
      className={joinClassNames(
        'flex w-full gap-2 rounded px-1.5 py-1.5 text-left hover:bg-hover',
        thread.resolved && newSinceReview.length === 0 && 'opacity-60',
      )}
      onClick={() => onJump(thread.path, findJumpLine(thread), newestReply?.id ?? shown.id)}
      title={describeJump(thread)}
    >
      <img
        src={shown.authorAvatar}
        alt=""
        width={AVATAR_PX}
        height={AVATAR_PX}
        className="mt-0.5 size-5 shrink-0 rounded-full bg-panel-2"
      />
      <div className="min-w-0 flex-1 text-[12px]">
        <ThreadHeading thread={thread} shown={shown} last={last} newCount={newSinceReview.length} query={query} />
        <div className="line-clamp-2 text-muted">
          <MatchText text={excerptAround(shown.body, query.trim(), EXCERPT_CHARS)} query={query} />
        </div>
        <NewestReply reply={newestReply} />
        {replies.length > 0 && (
          <div className="mt-0.5 truncate text-[11px] text-muted">
            {countOf(replies.length, 'reply', 'replies')} · last by <span className="text-fg">{last.author}</span>
          </div>
        )}
      </div>
    </button>
  )
}
