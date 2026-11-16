import { memo, useState } from 'react'
import type { DraftComment } from '@shared/pull.types'
import type { CommentThread } from './comment-threads.util'
import { summarizeComment } from '@shared/excerpt.util'
import { ago, cx } from '../common/format.util'
import { groupBy } from '../common/group.util'

/** Right-hand sidebar: every review thread and your pending comments, grouped by file. Click to jump. */
export const CommentsPanel = memo(function CommentsPanel(props: {
  threads: readonly CommentThread[]
  drafts: readonly DraftComment[]
  current: string | null
  onJump: (path: string, line: number | null) => void
  onClose: () => void
}) {
  const [showResolved, setShowResolved] = useState(false)
  const resolvedCount = props.threads.filter((t) => t.resolved).length
  const visible = showResolved ? props.threads : props.threads.filter((t) => !t.resolved)
  const byFile = groupBy(visible, (t) => t.path)

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted">
        <span className="font-semibold tracking-wide uppercase">Comments {props.threads.length - resolvedCount}</span>
        <span>open</span>
        <div className="flex-1" />
        {resolvedCount > 0 && (
          <button className={cx('rounded px-1.5 py-0.5', showResolved ? 'bg-hover text-fg' : 'hover:text-fg')} onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? 'Hide' : 'Show'} {resolvedCount} resolved
          </button>
        )}
        <button className="rounded px-1.5 py-0.5 hover:text-fg" title="Hide comments" onClick={props.onClose}>
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {props.drafts.length > 0 && <Drafts drafts={props.drafts} onJump={props.onJump} />}
        {!visible.length && !props.drafts.length && (
          <div className="px-3 py-8 text-center text-[12px] text-muted">{props.threads.length ? 'Every thread is resolved.' : 'No review comments yet.'}</div>
        )}
        {[...byFile].map(([path, threads]) => (
          <div key={path} className="mb-2">
            <FileHeading path={path} current={path === props.current} />
            {threads.map((t) => (
              <ThreadItem key={t.rootId} thread={t} onJump={props.onJump} />
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
})

function FileHeading({ path, current }: { path: string; current: boolean }) {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return (
    <div className={cx('truncate px-1.5 pt-1.5 pb-0.5 font-mono text-[10.5px]', current ? 'text-accent' : 'text-muted')} title={path}>
      {name}
    </div>
  )
}

function ThreadItem({ thread: t, onJump }: { thread: CommentThread; onJump: (path: string, line: number | null) => void }) {
  const [root, ...replies] = t.comments
  const last = replies.at(-1)
  return (
    <button
      className={cx('flex w-full gap-2 rounded px-1.5 py-1.5 text-left hover:bg-hover', t.resolved && 'opacity-60')}
      onClick={() => onJump(t.path, t.side === 'RIGHT' && !t.outdated ? t.line : null)}
      title={t.outdated ? 'The code this thread was on has changed since' : `Go to line ${t.line}`}
    >
      <img src={root!.authorAvatar} alt="" className="mt-0.5 size-5 shrink-0 rounded-full bg-panel-2" />
      <div className="min-w-0 flex-1 text-[12px]">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{root!.author}</span>
          <span className="shrink-0 font-mono text-[10.5px] text-muted">{t.outdated || t.line == null ? 'outdated' : `L${t.line}`}</span>
          {t.resolved && <span className="chip bg-ok/15 py-0 text-[10px] text-ok">resolved</span>}
          <span className="ml-auto shrink-0 text-[10.5px] text-muted">{ago((last ?? root!).createdAt)}</span>
        </div>
        <div className="line-clamp-2 text-muted">{summarizeComment(root!.body, 200)}</div>
        {last && (
          <div className="mt-0.5 truncate text-[11px] text-muted">
            {replies.length} repl{replies.length === 1 ? 'y' : 'ies'} · last by <span className="text-fg">{last.author}</span>
          </div>
        )}
      </div>
    </button>
  )
}

function Drafts({ drafts, onJump }: { drafts: readonly DraftComment[]; onJump: (path: string, line: number | null) => void }) {
  return (
    <div className="mb-2 rounded-md border border-accent/30 bg-accent/5 pb-1">
      <div className="px-1.5 pt-1.5 pb-0.5 text-[10.5px] font-semibold tracking-wide text-accent uppercase">Your pending comments {drafts.length}</div>
      {drafts.map((d) => (
        <button key={d.id} className="block w-full rounded px-1.5 py-1 text-left text-[12px] hover:bg-hover" onClick={() => onJump(d.path, d.side === 'RIGHT' ? d.line : null)}>
          <span className="font-mono text-[10.5px] text-muted">
            {d.path.slice(d.path.lastIndexOf('/') + 1)}:{d.line}
            {d.inReplyTo ? ' · reply' : ''}
          </span>
          <div className="line-clamp-2">{summarizeComment(d.body, 200)}</div>
        </button>
      ))}
    </div>
  )
}
