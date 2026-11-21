import type { FocusItem } from '@shared/claude.types.ts'
import type { DraftComment, ReviewComment } from '@shared/pull.types.ts'
import { type CommentActions, ReviewThread } from './review-comments.component.tsx'

/** Why the briefing asks you to look at parts of this file. */
export function FocusReasons({ focus }: { focus: readonly FocusItem[] }) {
  if (focus.length === 0) {
    return null
  }
  return (
    <div className="border-b border-line bg-focus/5 px-4 py-2 text-[12px]">
      {focus.map((focusItem) => (
        <div key={`${focusItem.lines}:${focusItem.reason}`} className="flex gap-2">
          <span className="font-mono text-focus">{focusItem.lines || 'file'}</span>
          <span className="text-muted">{focusItem.reason}</span>
        </div>
      ))}
    </div>
  )
}

/** Threads on lines that are no longer in the diff, replies included, folded away. */
export function OutdatedComments({
  path,
  threads,
  allDrafts,
  actions,
}: {
  path: string
  threads: readonly ReviewComment[][]
  allDrafts: readonly DraftComment[]
  actions: CommentActions
}) {
  if (threads.length === 0) {
    return null
  }
  return (
    <details className="border-b border-line px-4 py-2 text-[12px]">
      <summary className="cursor-pointer text-muted">{threads.length} outdated comment thread(s)</summary>
      <div className="mt-2 max-w-3xl space-y-2">
        {threads.map((thread) => (
          <ReviewThread key={thread[0]?.id} path={path} thread={thread} allDrafts={allDrafts} actions={actions} />
        ))}
      </div>
    </details>
  )
}
