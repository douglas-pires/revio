import type { AskThread } from '@shared/claude.types.ts'
import { ago, countOf, cx } from '../common/format.util.ts'

function linesOf(t: AskThread) {
  if (t.startLine === t.endLine) {
    return `${t.startLine}`
  }
  return `${t.startLine}–${t.endLine}`
}

/** Every Ask Claude chat on this PR, newest first; pick one to open it. */
export function AskHistory(props: {
  threads: AskThread[]
  currentId: string
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <ul className="space-y-1.5">
      {props.threads.map((t) => {
        const question = t.messages.find((m) => m.role === 'user')?.content
        const answers = t.messages.filter((m) => m.role === 'assistant').length
        return (
          <li key={t.id} className="group/chat relative">
            <button
              type="button"
              className={cx(
                'w-full rounded-md border px-2.5 py-2 text-left hover:bg-hover',
                t.id === props.currentId && 'border-accent/60 bg-hover',
                !(t.id === props.currentId) && 'border-line',
              )}
              onClick={() => props.onOpen(t.id)}
            >
              <div className="truncate font-mono text-[11px] text-accent" title={`${t.path}:${linesOf(t)}`}>
                {t.path}:{linesOf(t)}
              </div>
              <div className={cx('mt-0.5 line-clamp-2 text-[12.5px]', !question && 'text-muted italic')}>
                {question ?? 'No questions yet'}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {countOf(answers, 'answer', 'answers')} · {ago(t.createdAt)} ago
              </div>
            </button>
            {t.messages.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost absolute top-1 right-1 px-1 py-0 text-[11px] text-muted opacity-0 transition group-hover/chat:opacity-100 hover:text-danger focus:opacity-100"
                title="Delete this chat"
                aria-label="Delete this chat"
                onClick={() => props.onDelete(t.id)}
              >
                ✕
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
