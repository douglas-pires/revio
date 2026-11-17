import type { DraftComment, ReviewComment } from '@shared/pull.types'
import { Composer, DraftView, ReviewThread, type CommentActions } from './review-comments.component'

export interface ComposerSpec {
  label: string
  suggestion?: string
  onSubmit: (body: string) => void
  onAsk: () => void
  onCancel: () => void
}

/** Threads, drafts and the open comment box under one diff line. */
export function LineAnnotations(props: {
  path: string
  threads: readonly ReviewComment[][]
  drafts: readonly DraftComment[]
  /** Every draft on the file, for the replies drafted under each thread. */
  allDrafts: readonly DraftComment[]
  composer: ComposerSpec | null
  actions: CommentActions
}) {
  return (
    <div className="max-w-3xl space-y-2">
      {props.threads.map((t) => (
        <ReviewThread key={t[0]!.id} path={props.path} thread={t} allDrafts={props.allDrafts} actions={props.actions} />
      ))}
      {props.drafts.map((d) => (
        <DraftView key={d.id} d={d} onUpdate={props.actions.onUpdateDraft} onDelete={props.actions.onDeleteDraft} />
      ))}
      {props.composer && <Composer {...props.composer} />}
    </div>
  )
}
