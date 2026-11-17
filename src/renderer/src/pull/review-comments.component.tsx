import { useCallback, useState } from 'react'
import type { DraftComment, ReviewComment } from '@shared/pull.types'
import { ago, cx } from '../common/format.util'
import { Markdown } from '../common/markdown.component'
import { ReactionBar } from './reaction-bar.component'
import { useOpenReplyIfTarget } from './use-reply-target.hook'

export function CommentView({ c }: { c: ReviewComment }) {
  return (
    <div data-comment-id={c.id} className="flex scroll-mt-12 gap-2 rounded">
      <img src={c.authorAvatar} alt="" className="mt-0.5 size-5 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px]">
          <span className="font-semibold text-fg">{c.author}</span>{' '}
          <a className="text-muted hover:underline" href={c.url} onClick={(e) => { e.preventDefault(); void window.revio.openExternal(c.url) }}>
            {ago(c.createdAt)} ago
          </a>
        </div>
        <Markdown className="text-[12.5px]">{c.body}</Markdown>
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
export function ReviewThread({ path, thread, allDrafts, actions }: { path: string; thread: ReviewComment[]; allDrafts: readonly DraftComment[]; actions: CommentActions }) {
  const root = thread[0]!
  return (
    <Thread
      thread={thread}
      drafts={allDrafts.filter((d) => d.inReplyTo === root.id)}
      onReplyNow={(body) => actions.onReplyNow(root.id, body)}
      onReplyLater={(body) => actions.onAddDraft({ path, side: root.side, line: root.outdated ? null : root.line, body, inReplyTo: root.id })}
      onUpdateDraft={actions.onUpdateDraft}
      onDeleteDraft={actions.onDeleteDraft}
    />
  )
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
  useOpenReplyIfTarget(props.thread.map((c) => c.id), openReply)
  return (
    <div className="space-y-2 rounded-md border border-line bg-panel p-3">
      {props.thread.map((c) => (
        <CommentView key={c.id} c={c} />
      ))}
      {props.drafts.map((d) => (
        <DraftView key={d.id} d={d} onUpdate={props.onUpdateDraft} onDelete={props.onDeleteDraft} />
      ))}
      {replying ? (
        <Composer
          label="Reply"
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
      ) : (
        <button className="input text-left text-muted" onClick={() => setReplying(true)}>
          Reply…
        </button>
      )}
    </div>
  )
}

export function DraftView({ d, onUpdate, onDelete }: { d: DraftComment; onUpdate: (id: string, body: string) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  if (editing)
    return (
      <Composer
        label="Edit draft"
        initial={d.body}
        onCancel={() => setEditing(false)}
        onSubmit={(body) => {
          onUpdate(d.id, body)
          setEditing(false)
        }}
      />
    )
  return (
    <div className="rounded-md border border-warn/40 bg-warn/5 p-3">
      <div className="mb-1 flex items-center gap-2 text-[11.5px]">
        <span className="chip bg-warn/20 text-warn">Pending</span>
        {d.startLine && <span className="text-muted">lines {d.startLine}–{d.line}</span>}
        <div className="flex-1" />
        <button className="btn btn-ghost py-0" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button className="btn btn-ghost py-0 text-danger" onClick={() => onDelete(d.id)}>
          Delete
        </button>
      </div>
      <Markdown className="text-[12.5px]">{d.body}</Markdown>
    </div>
  )
}

export function Composer(props: {
  label: string
  initial?: string
  suggestion?: string
  onCancel: () => void
  /** Adds the comment to your pending review. Without it, the box only replies right away. */
  onSubmit?: (body: string) => void
  onSubmitNow?: (body: string) => Promise<void>
  onAsk?: () => void
}) {
  const [body, setBody] = useState(props.initial ?? '')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const sendNow = async () => {
    if (!props.onSubmitNow || !body.trim() || busy) return
    setBusy(true)
    try {
      await props.onSubmitNow(body.trim())
    } finally {
      setBusy(false)
    }
  }
  const submit = () => (props.onSubmit ? body.trim() && props.onSubmit(body.trim()) : void sendNow())
  return (
    <div className="rounded-md border border-accent/50 bg-panel p-2">
      <div className="mb-1.5 flex items-center gap-1 text-[11.5px] text-muted">
        <span className="mr-2">{props.label}</span>
        <button className={cx('btn btn-ghost py-0', !preview && 'bg-hover')} onClick={() => setPreview(false)}>
          Write
        </button>
        <button className={cx('btn btn-ghost py-0', preview && 'bg-hover')} onClick={() => setPreview(true)}>
          Preview
        </button>
        <div className="flex-1" />
        {props.onAsk && (
          <button className="btn btn-ghost py-0 text-accent" title="Ask Claude about the selected lines" onClick={props.onAsk}>
            ✦ Ask Claude
          </button>
        )}
        {props.suggestion !== undefined && (
          <button
            className="btn btn-ghost py-0"
            title="Insert a GitHub suggestion block with the selected lines"
            onClick={() => setBody((b) => `${b}${b ? '\n' : ''}\`\`\`suggestion\n${props.suggestion}\n\`\`\`\n`)}
          >
            ± Suggest change
          </button>
        )}
      </div>
      {preview ? (
        <div className="min-h-20 rounded-md border border-line p-2">
          <Markdown className="text-[12.5px]">{body || '_Nothing to preview_'}</Markdown>
        </div>
      ) : (
        <textarea
          autoFocus
          className="input min-h-20 resize-y font-sans"
          placeholder={`Leave a comment (markdown). ⌘↵ to ${props.onSubmit ? 'add' : 'send'}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) submit()
            if (e.key === 'Escape') props.onCancel()
          }}
        />
      )}
      <div className="mt-1.5 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={props.onCancel}>
          Cancel
        </button>
        {props.onSubmitNow && (
          <button className={cx('btn', !props.onSubmit && 'btn-primary')} disabled={!body.trim() || busy} onClick={() => void sendNow()}>
            {busy ? 'Sending…' : 'Reply now'}
          </button>
        )}
        {props.onSubmit && (
          <button className="btn btn-primary" disabled={!body.trim()} onClick={submit}>
            {props.initial ? 'Update' : 'Add to review'}
          </button>
        )}
      </div>
    </div>
  )
}
