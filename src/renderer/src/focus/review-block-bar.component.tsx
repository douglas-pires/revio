import { joinClassNames } from '../common/format.util.ts'
import { ShortcutHint } from '../shortcuts/shortcut-hint.component.tsx'
import { formatClock, type ReviewBlock } from './review-block.util.ts'
import { describeReviews, type ReviewBlockState } from './use-review-block.hook.ts'

/** The running (or paused) block: the time left, and pause or end it. */
function RunningBar({ state, block }: { state: ReviewBlockState; block: ReviewBlock }) {
  const paused = block.endsAt === null
  return (
    <>
      <span
        className={joinClassNames('size-2 rounded-full', paused && 'bg-warn', !paused && 'animate-pulse bg-accent')}
      />
      <span className="font-medium text-fg">Review block</span>
      <span className="font-mono text-fg tabular-nums">{formatClock(state.leftMs)}</span>
      <span>left of {block.minutes} min</span>
      {paused && <span className="text-warn">paused</span>}
      {block.reviews > 0 && <span>· {describeReviews(block.reviews)}</span>}
      <span className="flex-1" />
      <ShortcutHint action="review-block" description={paused ? 'Resume the block' : 'Pause the block'} place="bottom">
        <button type="button" className="no-drag btn btn-ghost py-0.5" onClick={state.togglePause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
      </ShortcutHint>
      <button type="button" className="no-drag btn btn-ghost py-0.5" onClick={state.end}>
        End
      </button>
    </>
  )
}

/** The block that ran out: how it went, and start another or close. */
function DoneBar({ block, state, onAnother }: { block: ReviewBlock; state: ReviewBlockState; onAnother: () => void }) {
  return (
    <>
      <span className="size-2 rounded-full bg-ok" />
      <span className="font-medium text-fg">Review block done</span>
      <span>
        {block.minutes} min · {describeReviews(block.reviews)}. Time for a break.
      </span>
      <span className="flex-1" />
      <button type="button" className="no-drag btn btn-ghost py-0.5" onClick={onAnother}>
        Start another
      </button>
      <button type="button" className="no-drag btn btn-ghost py-0.5" onClick={state.end}>
        Close
      </button>
    </>
  )
}

/** A strip above every screen while a review block is on, or has just ended. */
export function ReviewBlockBar({ state, onAnother }: { state: ReviewBlockState; onAnother: () => void }) {
  const { block } = state
  if (block === null) {
    return null
  }
  return (
    <div
      className={joinClassNames(
        'drag flex items-center gap-2 border-b border-line py-1.5 pr-3 pl-20 text-[12px] text-muted',
        state.over && 'bg-ok/10',
        !state.over && 'bg-accent/10',
      )}
    >
      {state.over && <DoneBar block={block} state={state} onAnother={onAnother} />}
      {!state.over && <RunningBar block={block} state={state} />}
    </div>
  )
}
