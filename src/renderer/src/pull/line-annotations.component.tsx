import type { DraftComment, ReviewComment } from '@shared/pull.types.ts'
import { Composer } from './composer.component.tsx'
import { type CommentActions, DraftView, ReviewThread } from './review-comments.component.tsx'

export interface ComposerSpec {
  label: string
  unsentKey: string
  suggestion?: string | undefined
  onSubmit: (body: string) => void
  onAsk: () => void
  onAddToChat?: (() => void) | undefined
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
      {props.threads.map((thread) => (
        <ReviewThread
          key={thread[0]?.id}
          path={props.path}
          thread={thread}
          allDrafts={props.allDrafts}
          actions={props.actions}
        />
      ))}
      {props.drafts.map((draft) => (
        <DraftView
          key={draft.id}
          draft={draft}
          onUpdate={props.actions.onUpdateDraft}
          onDelete={props.actions.onDeleteDraft}
        />
      ))}
      {props.composer !== null && <Composer {...props.composer} codePath={props.path} />}
    </div>
  )
}
