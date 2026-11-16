import type { DraftComment, ReviewComment } from '@shared/pull.types'
import { Composer, DraftView, Thread } from './review-comments.component'

/** Comments on the file as a whole: GitHub's file threads, your drafts for them, and the box to add one. */
export function FileComments(props: {
  path: string
  threads: readonly ReviewComment[][]
  /** Every draft on this file; file-level ones and replies to file threads are picked out here. */
  drafts: readonly DraftComment[]
  composing: boolean
  onCloseComposer: () => void
  onAddDraft: (d: Omit<DraftComment, 'id'>) => void
  onUpdateDraft: (id: string, body: string) => void
  onDeleteDraft: (id: string) => void
  onReplyNow: (commentId: number, body: string) => Promise<void>
}) {
  const fileDrafts = props.drafts.filter((d) => d.line == null && !d.inReplyTo)
  if (!props.threads.length && !fileDrafts.length && !props.composing) return null
  return (
    <div className="max-w-3xl space-y-2 border-b border-line px-4 py-3">
      <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">On this file</div>
      {props.threads.map((thread) => {
        const root = thread[0]!
        return (
          <Thread
            key={root.id}
            thread={thread}
            drafts={props.drafts.filter((d) => d.inReplyTo === root.id)}
            onReplyNow={(body) => props.onReplyNow(root.id, body)}
            onReplyLater={(body) => props.onAddDraft({ path: props.path, side: root.side, line: null, body, inReplyTo: root.id })}
            onUpdateDraft={props.onUpdateDraft}
            onDeleteDraft={props.onDeleteDraft}
          />
        )
      })}
      {fileDrafts.map((d) => (
        <DraftView key={d.id} d={d} onUpdate={props.onUpdateDraft} onDelete={props.onDeleteDraft} />
      ))}
      {props.composing && (
        <Composer
          label="Comment on file"
          onCancel={props.onCloseComposer}
          onSubmit={(body) => {
            props.onAddDraft({ path: props.path, side: 'RIGHT', line: null, body })
            props.onCloseComposer()
          }}
        />
      )}
    </div>
  )
}
