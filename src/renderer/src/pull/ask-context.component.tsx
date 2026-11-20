import type { AskContext } from '@shared/claude.types.ts'

/** Where a selection is, short: the file name and its lines (old side marked). */
function placeOf(c: AskContext) {
  const name = c.path.slice(c.path.lastIndexOf('/') + 1)
  let lines = `${c.startLine}–${c.endLine}`
  if (c.startLine === c.endLine) {
    lines = `${c.startLine}`
  }
  if (c.side === 'LEFT') {
    return `${name}:${lines} (old)`
  }
  return `${name}:${lines}`
}

/** Lines added to the chat, waiting to go with your next question; each can be taken out. */
export function PendingContext({
  context,
  onRemove,
}: {
  context: readonly AskContext[]
  onRemove: (index: number) => void
}) {
  if (context.length === 0) {
    return null
  }
  return (
    <div data-pending-context={true} className="flex flex-wrap items-center gap-1 px-3 pt-2 text-[11.5px]">
      <span className="text-muted">With your next question:</span>
      {context.map((c, i) => (
        <span
          key={`${c.path}:${c.side}:${c.startLine}-${c.endLine}`}
          className="chip gap-1 bg-accent/15 py-0 font-mono text-accent"
          title={`${c.path}\n${c.snippet}`}
        >
          + {placeOf(c)}
          <button
            type="button"
            className="text-muted hover:text-fg"
            aria-label={`Remove ${placeOf(c)}`}
            onClick={() => onRemove(i)}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}

/** The lines a question was sent with, under the question. */
export function SentContext({ context }: { context: readonly AskContext[] | undefined }) {
  if (!context?.length) {
    return null
  }
  return (
    <div className="mt-1 flex flex-wrap justify-end gap-1">
      {context.map((c) => (
        <span
          key={`${c.path}:${c.side}:${c.startLine}-${c.endLine}`}
          className="chip bg-accent/10 py-0 font-mono text-[11px] text-accent"
          title={`${c.path}\n${c.snippet}`}
        >
          + {placeOf(c)}
        </span>
      ))}
    </div>
  )
}
