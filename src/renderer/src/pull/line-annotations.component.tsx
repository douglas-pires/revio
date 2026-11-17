import type { DraftComment, ReviewComment } from '@shared/pull.types'
import { Composer, DraftView, Thread } from './review-comments.component'

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
  onAddDraft: (d: Omit<DraftComment, 'id'>) => void
  onUpdateDraft: (id: string, body: string) => void
  onDeleteDraft: (id: string) => void
  onReplyNow: (commentId: number, body: string) => Promise<void>
}) {
  return (
    <div className="max-w-3xl space-y-2">
      {props.threads.map((t) => {
        const root = t[0]!
        return (
          <Thread
            key={root.id}
            thread={t}
            drafts={props.allDrafts.filter((d) => d.inReplyTo === root.id)}
            onReplyNow={(body) => props.onReplyNow(root.id, body)}
            onReplyLater={(body) => props.onAddDraft({ path: props.path, side: root.side, line: root.line!, body, inReplyTo: root.id })}
            onUpdateDraft={props.onUpdateDraft}
            onDeleteDraft={props.onDeleteDraft}
          />
        )
      })}
      {props.drafts.map((d) => (
        <DraftView key={d.id} d={d} onUpdate={props.onUpdateDraft} onDelete={props.onDeleteDraft} />
      ))}
      {props.composer && <Composer {...props.composer} />}
    </div>
  )
}
