import type { AskThread } from '@shared/claude.types.ts'
import { countOf, formatAge, joinClassNames } from '../common/format.util.ts'

function describeLines(thread: AskThread) {
  if (thread.startLine === thread.endLine) {
    return `${thread.startLine}`
  }
  return `${thread.startLine}–${thread.endLine}`
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
      {props.threads.map((thread) => {
        const question = thread.messages.find((message) => message.role === 'user')?.content
        const answers = thread.messages.filter((message) => message.role === 'assistant').length
        return (
          <li key={thread.id} className="group/chat relative">
            <button
              type="button"
              className={joinClassNames(
                'w-full rounded-md border px-2.5 py-2 text-left hover:bg-hover',
                thread.id === props.currentId && 'border-accent/60 bg-hover',
                !(thread.id === props.currentId) && 'border-line',
              )}
              onClick={() => props.onOpen(thread.id)}
            >
              <div
                className="truncate font-mono text-[11px] text-accent"
                title={`${thread.path}:${describeLines(thread)}`}
              >
                {thread.path}:{describeLines(thread)}
              </div>
              <div className={joinClassNames('mt-0.5 line-clamp-2 text-[12.5px]', !question && 'text-muted italic')}>
                {question ?? 'No questions yet'}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {countOf(answers, 'answer', 'answers')} · {formatAge(thread.createdAt)} ago
              </div>
            </button>
            {thread.messages.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost absolute top-1 right-1 px-1 py-0 text-[11px] text-muted opacity-0 transition group-hover/chat:opacity-100 hover:text-danger focus:opacity-100"
                title="Delete this chat"
                aria-label="Delete this chat"
                onClick={() => props.onDelete(thread.id)}
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
