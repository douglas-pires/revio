import type { DraftComment, ReviewComment } from '@shared/pull.types'
import { Composer, DraftView, ReviewThread, type CommentActions } from './review-comments.component'

/** Comments on the file as a whole: GitHub's file threads, your drafts for them, and the box to add one. */
export function FileComments(props: {
  path: string
  threads: readonly ReviewComment[][]
  /** Every draft on this file; file-level ones and replies to file threads are picked out here. */
  drafts: readonly DraftComment[]
  composing: boolean
  onCloseComposer: () => void
  actions: CommentActions
}) {
  const { actions } = props
  const fileDrafts = props.drafts.filter((d) => d.line == null && !d.inReplyTo)
  if (!props.threads.length && !fileDrafts.length && !props.composing) return null
  return (
    <div className="max-w-3xl space-y-2 border-b border-line px-4 py-3">
      <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">On this file</div>
      {props.threads.map((thread) => (
        <ReviewThread key={thread[0]!.id} path={props.path} thread={thread} allDrafts={props.drafts} actions={actions} />
      ))}
      {fileDrafts.map((d) => (
        <DraftView key={d.id} d={d} onUpdate={actions.onUpdateDraft} onDelete={actions.onDeleteDraft} />
      ))}
      {props.composing && (
        <Composer
          label="Comment on file"
          onCancel={props.onCloseComposer}
          onSubmit={(body) => {
            actions.onAddDraft({ path: props.path, side: 'RIGHT', line: null, body })
            props.onCloseComposer()
          }}
        />
      )}
    </div>
  )
}
