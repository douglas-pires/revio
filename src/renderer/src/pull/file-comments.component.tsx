import type { DraftComment, ReviewComment } from '@shared/pull.types.ts'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { Composer } from './composer.component.tsx'
import { type CommentActions, DraftView, ReviewThread } from './review-comments.component.tsx'
import { useUnsentScope } from './unsent-comments.util.ts'

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
  const scope = useUnsentScope()
  const fileDrafts = props.drafts.filter((draft) => draft.line === null && !draft.inReplyTo)
  if (!(props.threads.length > 0 || fileDrafts.length > 0 || props.composing)) {
    return null
  }
  return (
    <div className="max-w-3xl space-y-2 border-b border-line px-4 py-3">
      <SectionHeading title="On this file" className="mb-0" />
      {props.threads.map((thread) => (
        <ReviewThread
          key={thread[0]?.id}
          path={props.path}
          thread={thread}
          allDrafts={props.drafts}
          actions={actions}
        />
      ))}
      {fileDrafts.map((draft) => (
        <DraftView key={draft.id} draft={draft} onUpdate={actions.onUpdateDraft} onDelete={actions.onDeleteDraft} />
      ))}
      {Boolean(props.composing) && (
        <Composer
          label="Comment on file"
          codePath={props.path}
          unsentKey={`${scope}:file:${props.path}`}
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
