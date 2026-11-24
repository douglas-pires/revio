import type { DraftComment, ReviewComment } from '@shared/pull.types.ts'
import { useCallback, useState } from 'react'
import { CopyButton } from '../common/copy-button.component.tsx'
import { countOf, formatAge } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { ClosedReply } from './closed-reply.component.tsx'
import { Composer } from './composer.component.tsx'
import { ReactionBar } from './reaction-bar.component.tsx'
import { forgetUnsentComment, useUnsentComment } from './unsent-comments.util.ts'
import { UnsentNote } from './unsent-note.component.tsx'
import { useOpenReplyIfTarget } from './use-reply-target.hook.ts'
import { useThreadFold } from './use-thread-fold.hook.ts'

const AVATAR_PX = 20
const MARKDOWN_MARKS = /[`*_~]/gu

/** A comment's first line without markdown marks, for a one-line summary. */
function readFirstLineAsText(body: string) {
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
  const ids = props.thread.map((comment) => comment.id)
  useOpenReplyIfTarget(ids, openReply)
  const unsentKey = `reply:${props.thread[0]?.id}`
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
      {props.thread.map((comment) => (
        <CommentView key={comment.id} comment={comment} />
      ))}
      {props.drafts.map((draft) => (
        <DraftView key={draft.id} draft={draft} onUpdate={props.onUpdateDraft} onDelete={props.onDeleteDraft} />
      ))}
      {Boolean(replying) && (
        <Composer
          label="Reply"
          codePath={props.thread[0]?.path}
          unsentKey={unsentKey}
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
      {!replying && <ClosedReply unsentKey={unsentKey} onOpen={openReply} />}
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
  const unsentBody = useUnsentComment(`reply:${root?.id}`)
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
      {unsentBody !== undefined && (
        <span className="chip shrink-0 bg-warn/20 py-0 text-[10.5px] text-warn">✎ Reply not sent</span>
      )}
      <span className="min-w-0 flex-1 truncate text-muted">
        {last.author}: {readFirstLineAsText(last.body)}
      </span>
    </button>
  )
}

function CommentView({ comment }: { comment: ReviewComment }) {
  return (
    <div data-comment-id={comment.id} className="flex scroll-mt-12 gap-2 rounded">
      <img
        src={comment.authorAvatar}
        alt=""
        width={AVATAR_PX}
        height={AVATAR_PX}
        className="mt-0.5 size-5 shrink-0 rounded-full"
      />
      <div className="min-w-0 flex-1">
        <div className="group/comment flex items-baseline gap-1 text-[12px]">
          <span className="font-semibold text-fg">{comment.author}</span>
          <a
            className="text-muted hover:underline"
            href={comment.url}
            onClick={(event) => {
              event.preventDefault()
              globalThis.revio.openExternal(comment.url)
            }}
          >
            {formatAge(comment.createdAt)} ago
          </a>
          <CopyButton
            text={comment.url}
            title="Copy the comment's GitHub link"
            className="ml-auto text-[11px] text-muted opacity-0 hover:text-fg focus-visible:opacity-100 group-hover/comment:opacity-100"
          >
            Copy link
          </CopyButton>
        </div>
        <Markdown className="text-[12.5px]" codePath={comment.path}>
          {comment.body}
        </Markdown>
        <ReactionBar subjectId={comment.nodeId} reactions={comment.reactions} />
      </div>
    </div>
  )
}

/** What a reviewer can do with comments on a file: draft, edit and delete pending comments, or reply right away. */
export interface CommentActions {
  onAddDraft: (draft: Omit<DraftComment, 'id'>) => void
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
      drafts={allDrafts.filter((draft) => draft.inReplyTo === root.id)}
      onReplyNow={(body) => actions.onReplyNow(root.id, body)}
      onReplyLater={(body) => actions.onAddDraft({ path, side: root.side, line, body, inReplyTo: root.id })}
      onUpdateDraft={actions.onUpdateDraft}
      onDeleteDraft={actions.onDeleteDraft}
    />
  )
}

export function DraftView({
  draft,
  onUpdate,
  onDelete,
}: {
  draft: DraftComment
  onUpdate: (id: string, body: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const unsentKey = `draft:${draft.id}`
  const unsentBody = useUnsentComment(unsentKey)
  if (editing) {
    return (
      <Composer
        label="Edit draft"
        codePath={draft.path}
        unsentKey={unsentKey}
        initial={draft.body}
        onCancel={() => setEditing(false)}
        onSubmit={(body) => {
          onUpdate(draft.id, body)
          setEditing(false)
        }}
      />
    )
  }
  return (
    <div className="rounded-md border border-warn/40 bg-warn/5 p-3">
      <div className="mb-1 flex items-center gap-2 text-[11.5px]">
        <span className="chip bg-warn/20 text-warn">Pending</span>
        {Boolean(draft.startLine) && (
          <span className="text-muted">
            lines {draft.startLine}–{draft.line}
          </span>
        )}
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost py-0" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className="btn btn-ghost py-0 text-danger" onClick={() => onDelete(draft.id)}>
          Delete
        </button>
      </div>
      <Markdown className="text-[12.5px]" codePath={draft.path}>
        {draft.body}
      </Markdown>
      {unsentBody !== undefined && (
        <UnsentNote
          className="mt-2"
          label="Edit not saved"
          body={unsentBody}
          onContinue={() => setEditing(true)}
          onDiscard={() => forgetUnsentComment(unsentKey)}
        />
      )}
    </div>
  )
}
