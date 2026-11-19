import { excerptAround } from '@shared/excerpt.util.ts'
import type { DraftComment } from '@shared/pull.types.ts'
import { memo, useEffect, useRef, useState } from 'react'
import { ago, countOf, cx } from '../common/format.util.ts'
import { groupBy } from '../common/group.util.ts'
import { isTyping } from '../common/keyboard.util.ts'
import { MatchText } from '../common/match-text.component.tsx'
import { type CommentThread, matchingComment, searchDrafts, searchThreads } from './comment-threads.util.ts'

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

/** A search looks through resolved threads too; otherwise they show only when asked. */
function visibleThreads(threads: readonly CommentThread[], query: string, showResolved: boolean) {
  if (query.trim()) {
    return searchThreads(threads, query)
  }
  if (showResolved) {
    return threads
  }
  return threads.filter((t) => !t.resolved)
}

/** How many matched, shown only while searching. */
function matchCount(searching: boolean, count: number) {
  if (!searching) {
    return null
  }
  return count
}

function emptyText(query: string, threadCount: number) {
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

function ThreadItem({ thread: t, query, onJump }: { thread: CommentThread; query: string; onJump: JumpTo }) {
  const [root, ...replies] = t.comments
  if (!root) {
    return null
  }
  const last = replies.at(-1) ?? root
  const shown = matchingComment(t, query) ?? root
  return (
    <button
      type="button"
      className={cx('flex w-full gap-2 rounded px-1.5 py-1.5 text-left hover:bg-hover', t.resolved && 'opacity-60')}
      onClick={() => onJump(t.path, jumpLineOf(t), shown.id)}
      title={threadTitle(t)}
    >
      <img
        src={root.authorAvatar}
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
          {Boolean(t.resolved) && <span className="chip bg-ok/15 py-0 text-[10px] text-ok">resolved</span>}
          <span className="ml-auto shrink-0 text-[10.5px] text-muted">{ago(last.createdAt)}</span>
        </div>
        <div className="line-clamp-2 text-muted">
          <MatchText text={excerptAround(shown.body, query.trim(), EXCERPT_CHARS)} query={query} />
        </div>
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
      <div className="px-1.5 pt-1.5 pb-0.5 text-[10.5px] font-semibold tracking-wide text-accent uppercase">
        Your pending comments {drafts.length}
      </div>
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
  onJump: JumpTo
  onClose: () => void
}) {
  const [showResolved, setShowResolved] = useState(false)
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''
  const resolvedCount = props.threads.filter((t) => t.resolved).length
  const visible = visibleThreads(props.threads, query, showResolved)
  const drafts = searchDrafts(props.drafts, query)
  const byFile = groupBy(visible, (t) => t.path)

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted">
        <span className="font-semibold tracking-wide uppercase">Comments {props.threads.length - resolvedCount}</span>
        <span>open</span>
        <div className="flex-1" />
        {resolvedCount > 0 && (
          <button
            type="button"
            className={cx(
              'rounded px-1.5 py-0.5',
              showResolved && 'bg-hover text-fg',
              !showResolved && 'hover:text-fg',
            )}
            onClick={() => setShowResolved(!showResolved)}
          >
            {Boolean(showResolved) && 'Hide'}
            {!showResolved && 'Show'} {resolvedCount} resolved
          </button>
        )}
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:text-fg"
          title="Hide comments"
          onClick={props.onClose}
        >
          ✕
        </button>
      </div>
      <CommentSearch
        query={query}
        onChange={setQuery}
        matches={matchCount(searching, visible.length + drafts.length)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {drafts.length > 0 && <Drafts drafts={drafts} query={query} onJump={props.onJump} />}
        {!(visible.length > 0 || drafts.length > 0) && (
          <div className="px-3 py-8 text-center text-[12px] text-muted">{emptyText(query, props.threads.length)}</div>
        )}
        {[...byFile].map(([path, threads]) => (
          <div key={path} className="mb-2">
            <FileHeading path={path} current={path === props.current} />
            {threads.map((t) => (
              <ThreadItem key={t.rootId} thread={t} query={query} onJump={props.onJump} />
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
})
