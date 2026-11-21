import { excerptAround } from '@shared/excerpt.util.ts'
import type { DraftComment, ReviewComment } from '@shared/pull.types.ts'
import { memo, useEffect, useRef, useState } from 'react'
import { ago, countOf, cx } from '../common/format.util.ts'
import { groupBy } from '../common/group.util.ts'
import { isTyping } from '../common/keyboard.util.ts'
import { MatchText } from '../common/match-text.component.tsx'
import { PanelHeader } from '../common/panel-header.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { ToggleButton } from '../common/toggle-button.component.tsx'
import {
  type CommentThread,
  matchingComment,
  newComments,
  type ReviewedBy,
  searchDrafts,
  searchThreads,
} from './comment-threads.util.ts'

/** Characters of a comment shown in the panel, around a search match when there is one. */
const EXCERPT_CHARS = 200
const AVATAR_PX = 20

/** The line to jump to: only new-side lines can be scrolled to in the diff. */
function newSideLine(side: DraftComment['side'], line: number | null) {
  if (side !== 'RIGHT') {
    return null
  }
  return line
}

function jumpLineOf(t: CommentThread) {
  if (t.outdated) {
    return null
  }
  return newSideLine(t.side, t.line)
}

function threadTitle(t: CommentThread) {
  if (t.outdated) {
    return 'The code this thread was on has changed since'
  }
  return `Go to line ${t.line}`
}

/** Resolved, with nothing new since your last review: hidden until you ask for resolved threads. */
function isSettled(t: CommentThread, reviewed: ReviewedBy) {
  return t.resolved && newComments(t, reviewed).length === 0
}

/**
 * A search looks through resolved threads too. Otherwise a resolved thread shows only when asked, unless someone
 * commented on it since your last review (the author's "fixed" as they resolve it, say).
 */
function visibleThreads(threads: readonly CommentThread[], query: string, showResolved: boolean, reviewed: ReviewedBy) {
  if (query.trim()) {
    return searchThreads(threads, query)
  }
  if (showResolved) {
    return threads
  }
  return threads.filter((t) => !isSettled(t, reviewed))
}

/**
 * The comment a thread previews: the search match, else the first one. The thread always reads as the comment
 * that opened it, so your own comments stay findable once someone replies; new replies show beneath it.
 */
function pickPreviewedComment(thread: CommentThread, query: string) {
  if (query.trim()) {
    return matchingComment(thread, query)
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

/** Whether you commented in the thread. */
function hasYourComment(thread: CommentThread, viewer: string) {
  return thread.comments.some((comment) => comment.author === viewer)
}

/** Only your threads when `onlyYours` is on; every thread otherwise. */
function keepYourThreads(threads: readonly CommentThread[], onlyYours: boolean, viewer: string) {
  if (!onlyYours) {
    return threads
  }
  return threads.filter((thread) => hasYourComment(thread, viewer))
}

/** How many matched, shown only while searching. */
function matchCount(searching: boolean, count: number) {
  if (!searching) {
    return null
  }
  return count
}

function describeEmptyList(query: string, threadCount: number, onlyYours: boolean) {
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

/** Goes to a file, line and (optionally) a comment in the diff. */
type JumpTo = (path: string, line: number | null, commentId?: number) => void

function FileHeading({ path, current }: { path: string; current: boolean }) {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return (
    <div
      className={cx(
        'truncate px-1.5 pt-1.5 pb-0.5 font-mono text-[10.5px]',
        current && 'text-accent',
        !current && 'text-muted',
      )}
      title={path}
    >
      {name}
    </div>
  )
}

/** Filters the panel; `/` focuses it and Escape clears it. */
function CommentSearch({
  query,
  onChange,
  matches,
}: {
  query: string
  onChange: (q: string) => void
  matches: number | null
}) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || isTyping(e.target)) {
        return
      }
      e.preventDefault()
      input.current?.focus()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="px-3 pb-2">
      <input
        ref={input}
        type="search"
        aria-label="Search comments"
        placeholder="Search comments  /"
        className="input py-1 text-[12px]"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('')
            e.currentTarget.blur()
          }
        }}
      />
      {matches !== null && <div className="mt-1 text-[11px] text-muted">{countOf(matches, 'match', 'matches')}</div>}
    </div>
  )
}

function ThreadItem({
  thread: t,
  query,
  reviewed,
  onJump,
}: {
  thread: CommentThread
  query: string
  reviewed: ReviewedBy
  onJump: JumpTo
}) {
  const [root, ...replies] = t.comments
  if (!root) {
    return null
  }
  const last = replies.at(-1) ?? root
  const fresh = newComments(t, reviewed)
  const shown = pickPreviewedComment(t, query) ?? root
  const newestReply = findNewestReplyToShow(fresh, shown, query)
  return (
    <button
      type="button"
      className={cx(
        'flex w-full gap-2 rounded px-1.5 py-1.5 text-left hover:bg-hover',
        t.resolved && fresh.length === 0 && 'opacity-60',
      )}
      onClick={() => onJump(t.path, jumpLineOf(t), newestReply?.id ?? shown.id)}
      title={threadTitle(t)}
    >
      <img
        src={shown.authorAvatar}
        alt=""
        width={AVATAR_PX}
        height={AVATAR_PX}
        className="mt-0.5 size-5 shrink-0 rounded-full bg-panel-2"
      />
      <div className="min-w-0 flex-1 text-[12px]">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">
            <MatchText text={shown.author} query={query} />
          </span>
          <span className="shrink-0 font-mono text-[10.5px] text-muted">{describeThreadLine(t)}</span>
          {fresh.length > 0 && (
            <span className="chip bg-accent/15 py-0 text-[10px] text-accent" title="Since your last review">
              {fresh.length} new
            </span>
          )}
          {Boolean(t.resolved) && <span className="chip bg-ok/15 py-0 text-[10px] text-ok">resolved</span>}
          <span className="ml-auto shrink-0 text-[10.5px] text-muted">{ago(last.createdAt)}</span>
        </div>
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

function Drafts({
  drafts,
  query,
  onJump,
}: {
  drafts: readonly DraftComment[]
  query: string
  onJump: (path: string, line: number | null) => void
}) {
  return (
    <div className="mb-2 rounded-md border border-accent/30 bg-accent/5 pb-1">
      <SectionHeading
        title="Your pending comments"
        count={drafts.length}
        tone="accent"
        className="mb-0 px-1.5 pt-1.5 pb-0.5"
      />
      {drafts.map((d) => (
        <button
          type="button"
          key={d.id}
          className="block w-full rounded px-1.5 py-1 text-left text-[12px] hover:bg-hover"
          onClick={() => onJump(d.path, newSideLine(d.side, d.line))}
        >
          <span className="font-mono text-[10.5px] text-muted">
            {d.path.slice(d.path.lastIndexOf('/') + 1)}
            {d.line === null && ' · file'}
            {!(d.line === null) && `:${d.line}`}
            {Boolean(d.inReplyTo) && ' · reply'}
          </span>
          <div className="line-clamp-2">
            <MatchText text={excerptAround(d.body, query.trim(), EXCERPT_CHARS)} query={query} />
          </div>
        </button>
      ))}
    </div>
  )
}

function describeThreadLine(t: CommentThread) {
  if (t.onFile) {
    return 'file'
  }
  if (t.outdated || t.line === null) {
    return 'outdated'
  }
  return `L${t.line}`
}

/** Right-hand sidebar: every review thread and your pending comments, grouped by file. Click to jump. */
export const CommentsPanel = memo(function CommentsPanelView(props: {
  threads: readonly CommentThread[]
  drafts: readonly DraftComment[]
  current: string | null
  reviewed: ReviewedBy
  onJump: JumpTo
  onClose: () => void
}) {
  const { reviewed } = props
  const [showResolved, setShowResolved] = useState(false)
  const [query, setQuery] = useState('')
  const [onlyYours, setOnlyYours] = useState(false)
  const yourThreadCount = props.threads.filter((thread) => hasYourComment(thread, reviewed.viewer)).length
  const searching = query.trim() !== ''
  const resolvedCount = props.threads.filter((t) => t.resolved).length
  const settledCount = props.threads.filter((t) => isSettled(t, reviewed)).length
  const newCount = props.threads.reduce((n, t) => n + newComments(t, reviewed).length, 0)
  const visible = visibleThreads(
    keepYourThreads(props.threads, onlyYours, reviewed.viewer),
    query,
    showResolved,
    reviewed,
  )
  const drafts = searchDrafts(props.drafts, query)
  const byFile = groupBy(visible, (t) => t.path)

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-panel">
      <PanelHeader
        title="Comments"
        detail={
          <span className="whitespace-nowrap">
            {props.threads.length - resolvedCount} open
            {newCount > 0 && (
              <span className="text-accent" title="Comments by others since your last review">
                {' '}
                · {newCount} new
              </span>
            )}
          </span>
        }
        actions={
          <>
            {yourThreadCount > 0 && (
              <ToggleButton on={onlyYours} onToggle={() => setOnlyYours(!onlyYours)}>
                Mine {yourThreadCount}
              </ToggleButton>
            )}
            {settledCount > 0 && (
              <ToggleButton on={showResolved} onToggle={() => setShowResolved(!showResolved)}>
                {Boolean(showResolved) && 'Hide'}
                {!showResolved && 'Show'} {settledCount} resolved
              </ToggleButton>
            )}
          </>
        }
        onClose={props.onClose}
        closeLabel="Hide comments"
      />
      <CommentSearch
        query={query}
        onChange={setQuery}
        matches={matchCount(searching, visible.length + drafts.length)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {drafts.length > 0 && <Drafts drafts={drafts} query={query} onJump={props.onJump} />}
        {!(visible.length > 0 || drafts.length > 0) && (
          <div className="px-3 py-8 text-center text-[12px] text-muted">
            {describeEmptyList(query, props.threads.length, onlyYours)}
          </div>
        )}
        {[...byFile].map(([path, threads]) => (
          <div key={path} className="mb-2">
            <FileHeading path={path} current={path === props.current} />
            {threads.map((t) => (
              <ThreadItem key={t.rootId} thread={t} query={query} reviewed={reviewed} onJump={props.onJump} />
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
})
