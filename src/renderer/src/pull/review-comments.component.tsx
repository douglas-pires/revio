import type { DraftComment, ReviewComment } from '@shared/pull.types.ts'

import { useCallback, useState } from 'react'

import { ago, countOf } from '../common/format.util.ts'

import { Markdown } from '../common/markdown.component.tsx'

import { Composer } from './composer.component.tsx'

import { ReactionBar } from './reaction-bar.component.tsx'

import { useOpenReplyIfTarget } from './use-reply-target.hook.ts'

import { useThreadFold } from './use-thread-fold.hook.ts'

const AVATAR_PX = 20
const MARKDOWN_MARKS = /[`*_~]/gu

/** A comment's first line without markdown marks, for a one-line summary. */
function firstLineAsText(body: string) {
  return (body.split('\n')[0] ?? '').replaceAll(MARKDOWN_MARKS, '')
}

function Thread(props: {
  thread: ReviewComment[]
  drafts: DraftComment[]
  onReplyNow: (body: string) => Promise<void>
  onReplyLater: (body: string) => void
  onUpdateDraft: (id: string, body: string) => void
  onDeleteDraft: (id: string) => void
}) {
  const [replying, setReplying] = useState(false)
  const openReply = useCallback(() => setReplying(true), [])
  const ids = props.thread.map((c) => c.id)
  useOpenReplyIfTarget(ids, openReply)
  const fold = useThreadFold()
  if (fold?.isFolded(ids)) {
    return (
      <FoldedThread
        thread={props.thread}
        pendingReplies={props.drafts.length}
        onOpen={() => fold.setFolded(ids, false)}
      />
    )
  }
  return (
    <div className="relative space-y-2 rounded-md border border-line bg-panel p-3">
      {fold !== null && (
        <button
          type="button"
          className="btn btn-ghost absolute top-2 right-2 px-1.5 py-0 text-muted"
          title="Minimize this thread"
          aria-label="Minimize this thread"
          onClick={() => fold.setFolded(ids, true)}
        >
          −
        </button>
      )}
      {props.thread.map((c) => (
        <CommentView key={c.id} c={c} />
      ))}
      {props.drafts.map((d) => (
        <DraftView key={d.id} d={d} onUpdate={props.onUpdateDraft} onDelete={props.onDeleteDraft} />
      ))}
      {Boolean(replying) && (
        <Composer
          label="Reply"
          codePath={props.thread[0]?.path}
          unsentKey={`reply:${props.thread[0]?.id}`}
          onCancel={() => setReplying(false)}
          onSubmit={(body) => {
            props.onReplyLater(body)
            setReplying(false)
          }}
          onSubmitNow={async (body) => {
            await props.onReplyNow(body)
            setReplying(false)
          }}
        />
      )}
      {!replying && (
        <button type="button" className="input text-left text-muted" onClick={() => setReplying(true)}>
          Reply…
        </button>
      )}
    </div>
  )
}

/** A minimised thread: who started it, how many comments, and the latest one's first line. Click to open it. */
function FoldedThread({
  thread,
  pendingReplies,
  onOpen,
}: {
  thread: readonly ReviewComment[]
  pendingReplies: number
  onOpen: () => void
}) {
  const [root] = thread
  const last = thread.at(-1)
  if (!(root && last)) {
    return null
  }
  return (
    <button
      type="button"
      data-folded-thread={root.id}
      className="flex w-full items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 text-left text-[12px] hover:bg-hover"
      title="Show this thread"
      onClick={onOpen}
    >
      <span aria-hidden={true} className="text-muted">
        ▸
      </span>
      <img src={root.authorAvatar} alt="" width={AVATAR_PX} height={AVATAR_PX} className="size-4 rounded-full" />
      <span className="shrink-0 font-medium">{root.author}</span>
      <span className="shrink-0 text-muted">{countOf(thread.length, 'comment', 'comments')}</span>
      {pendingReplies > 0 && (
        <span className="chip shrink-0 bg-warn/20 py-0 text-[10.5px] text-warn">
          {countOf(pendingReplies, 'pending reply', 'pending replies')}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-muted">
        {last.author}: {firstLineAsText(last.body)}
      </span>
    </button>
  )
}

export function CommentView({ c }: { c: ReviewComment }) {
  return (
    <div data-comment-id={c.id} className="flex scroll-mt-12 gap-2 rounded">
      <img
        src={c.authorAvatar}
        alt=""
        width={AVATAR_PX}
        height={AVATAR_PX}
        className="mt-0.5 size-5 shrink-0 rounded-full"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12px]">
          <span className="font-semibold text-fg">{c.author}</span>{' '}
          <a
            className="text-muted hover:underline"
            href={c.url}
            onClick={(e) => {
              e.preventDefault()
              globalThis.revio.openExternal(c.url)
            }}
          >
            {ago(c.createdAt)} ago
          </a>
        </div>
        <Markdown className="text-[12.5px]" codePath={c.path}>
          {c.body}
        </Markdown>
        <ReactionBar subjectId={c.nodeId} reactions={c.reactions} />
      </div>
    </div>
  )
}

/** What a reviewer can do with comments on a file: draft, edit and delete pending comments, or reply right away. */
export interface CommentActions {
  onAddDraft: (d: Omit<DraftComment, 'id'>) => void
  onUpdateDraft: (id: string, body: string) => void
  onDeleteDraft: (id: string) => void
  onReplyNow: (commentId: number, body: string) => Promise<void>
}

/** A GitHub thread on a file with your drafted replies to it; replies go into your review or out right away. */
export function ReviewThread({
  path,
  thread,
  allDrafts,
  actions,
}: {
  path: string
  thread: ReviewComment[]
  allDrafts: readonly DraftComment[]
  actions: CommentActions
}) {
  const [root] = thread
  if (!root) {
    return null
  }
  let { line } = root
  if (root.outdated) {
    line = null
  }
  return (
    <Thread
      thread={thread}
      drafts={allDrafts.filter((d) => d.inReplyTo === root.id)}
      onReplyNow={(body) => actions.onReplyNow(root.id, body)}
      onReplyLater={(body) => actions.onAddDraft({ path, side: root.side, line, body, inReplyTo: root.id })}
      onUpdateDraft={actions.onUpdateDraft}
      onDeleteDraft={actions.onDeleteDraft}
    />
  )
}

export function DraftView({
  d,
  onUpdate,
  onDelete,
}: {
  d: DraftComment
  onUpdate: (id: string, body: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <Composer
        label="Edit draft"
        codePath={d.path}
        unsentKey={`draft:${d.id}`}
        initial={d.body}
        onCancel={() => setEditing(false)}
        onSubmit={(body) => {
          onUpdate(d.id, body)
          setEditing(false)
        }}
      />
    )
  }
  return (
    <div className="rounded-md border border-warn/40 bg-warn/5 p-3">
      <div className="mb-1 flex items-center gap-2 text-[11.5px]">
        <span className="chip bg-warn/20 text-warn">Pending</span>
        {Boolean(d.startLine) && (
          <span className="text-muted">
            lines {d.startLine}–{d.line}
          </span>
        )}
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost py-0" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className="btn btn-ghost py-0 text-danger" onClick={() => onDelete(d.id)}>
          Delete
        </button>
      </div>
      <Markdown className="text-[12.5px]" codePath={d.path}>
        {d.body}
      </Markdown>
    </div>
  )
}
