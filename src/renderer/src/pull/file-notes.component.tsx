import type { FocusItem } from '@shared/claude.types'
import type { ReviewComment } from '@shared/pull.types'
import { CommentView } from './review-comments.component'

/** Why the briefing asks you to look at parts of this file. */
export function FocusReasons({ focus }: { focus: readonly FocusItem[] }) {
  if (!focus.length) return null
  return (
    <div className="border-b border-line bg-focus/5 px-4 py-2 text-[12px]">
      {focus.map((f, i) => (
        <div key={i} className="flex gap-2">
          <span className="font-mono text-focus">{f.lines || 'file'}</span>
          <span className="text-muted">{f.reason}</span>
        </div>
      ))}
    </div>
  )
}

/** Comments on lines that are no longer in the diff, folded away. */
export function OutdatedComments({ comments }: { comments: readonly ReviewComment[] }) {
  if (!comments.length) return null
  return (
    <details className="border-b border-line px-4 py-2 text-[12px] text-muted">
      <summary className="cursor-pointer">{comments.length} outdated comment thread(s)</summary>
      <div className="mt-2 space-y-2">
        {comments.map((c) => (
          <CommentView key={c.id} c={c} />
        ))}
      </div>
    </details>
  )
}
