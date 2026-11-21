import { useEffect, useState } from 'react'
import { Markdown } from '../common/markdown.component.tsx'
import { addPositions } from '../common/numbered-lines.util.ts'
import { type AskProgress, countSecondsSince } from './ask-progress.util.ts'

/** How often the elapsed time ticks. */
const TICK_MS = 1000
/** Characters of reasoning shown while Claude thinks: the latest, as it streams. */
const THINKING_TAIL = 600

/** The time now, updated every second while shown. */
function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}

function Steps({ steps, live }: { steps: readonly string[]; live: boolean }) {
  return (
    <ol className="space-y-0.5">
      {addPositions(steps).map(({ item: step, position }) => {
        // Positions count from 1, so the last step's is the length.
        const current = live && position === steps.length
        return (
          <li key={position} className="flex items-center gap-2">
            {Boolean(current) && <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />}
            {!current && (
              <span aria-hidden={true} className="w-2 shrink-0 text-ok">
                ✓
              </span>
            )}
            <span className="truncate">{step}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Reasoning({ text, tail }: { text: string; tail: boolean }) {
  if (!text) {
    return null
  }
  let shown = text
  if (tail && text.length > THINKING_TAIL) {
    shown = `…${text.slice(-THINKING_TAIL)}`
  }
  return (
    <div className="selectable mt-1.5 max-h-40 overflow-y-auto rounded-md border-l-2 border-line pl-2 whitespace-pre-wrap italic">
      {shown}
    </div>
  )
}

/**
 * What Claude is doing on your question, as Claude Code shows it: each step as it starts, with the time so far and its
 * reasoning while it thinks. Once the answer starts, it folds into "Worked for Ns", which opens to show the steps.
 */
export function AskActivity({ progress, answering }: { progress: AskProgress; answering: boolean }) {
  const seconds = countSecondsSince(progress, useNow())
  if (answering) {
    return (
      <details data-ask-activity="done" className="text-[12px] text-muted">
        <summary className="cursor-pointer select-none hover:text-fg">
          Worked for {seconds}s · {progress.steps.length} steps
        </summary>
        <div className="mt-1 pl-1">
          <Steps steps={progress.steps} live={false} />
          <Reasoning text={progress.thinking} tail={false} />
        </div>
      </details>
    )
  }
  return (
    <div data-ask-activity="live" role="status" className="text-[12px] text-muted">
      <Steps steps={progress.steps} live={true} />
      <div className="mt-1 pl-4 text-[11px]">{seconds}s</div>
      <Reasoning text={progress.thinking} tail={true} />
    </div>
  )
}

/** Above the latest answer: how it came about, folded ("Worked for 9s · 5 steps"), for this chat's last question. */
export function FinishedActivity({ progress, threadId }: { progress: AskProgress | null; threadId: string }) {
  if (!(progress?.finishedAt && progress.threadId === threadId && progress.steps.length > 0)) {
    return null
  }
  return <AskActivity progress={progress} answering={true} />
}

/** What Claude is doing (or a waiting note before it says), then the answer as it streams in. */
export function PendingAnswer({ text, progress }: { text: string; progress: AskProgress | null }) {
  const started = progress !== null && progress.steps.length > 0
  return (
    <div className="space-y-2">
      {progress !== null && started && <AskActivity progress={progress} answering={text !== ''} />}
      {!(started || text) && (
        <div className="flex items-center gap-2 text-muted">
          <span className="size-2 animate-pulse rounded-full bg-accent" /> Reading the file and the PR…
        </div>
      )}
      {text !== '' && <Markdown className="text-[13px]">{text}</Markdown>}
    </div>
  )
}
