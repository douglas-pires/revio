import { useContext } from 'react'
import { joinClassNames } from './format.util.ts'
import { HistoryContext } from './history.context.ts'

const BACK_PATH = 'M15 6l-6 6 6 6'
const FORWARD_PATH = 'M9 6l6 6-6 6'

function Arrow({ label, enabled, onClick, d }: { label: string; enabled: boolean; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!enabled}
      onClick={onClick}
      className={joinClassNames(
        'no-drag flex size-6 items-center justify-center rounded text-muted',
        'hover:bg-hover hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent',
      )}
    >
      <svg
        aria-hidden={true}
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </svg>
    </button>
  )
}

/** Back and forward (also ⌘[ / ⌘], swipes and mouse side buttons), at the start of every screen header. */
export function HistoryArrows() {
  const history = useContext(HistoryContext)
  if (!history) {
    return null
  }
  return (
    <div className="flex shrink-0 gap-0.5">
      <Arrow label="Back (⌘[)" enabled={history.canGoBack} onClick={history.back} d={BACK_PATH} />
      <Arrow label="Forward (⌘])" enabled={history.canGoForward} onClick={history.forward} d={FORWARD_PATH} />
    </div>
  )
}
