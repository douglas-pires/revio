import type { UpdateStatus } from '@shared/update.types.ts'
import { useState } from 'react'
import { UpdateButton } from './update-button.component.tsx'
import { openLink } from './update-links.util.ts'

const DISMISSED_KEY = 'revio.dismissedUpdate'

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/** Phases worth a bar you hid: something is under way, or went wrong. */
const ACTIVE_PHASES: ReadonlySet<string> = new Set(['downloading', 'ready', 'failed'])

/** A slim bar when a newer Revio is out. Hiding it hides that version only, until you start installing it. */
export function UpdateBanner({ status }: { status: UpdateStatus | null }) {
  const [dismissed, setDismissed] = useState(readDismissed)
  if (!(status?.available && status.latest)) {
    return null
  }
  const active = ACTIVE_PHASES.has(status.install.phase)
  if (dismissed === status.latest && !active) {
    return null
  }
  const { latest } = status
  const hide = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, latest)
    } catch {
      // Not remembered; it hides until the app restarts.
    }
    setDismissed(latest)
  }
  return (
    <div
      data-update-banner={true}
      className="drag flex shrink-0 items-center gap-3 border-b border-accent/40 bg-accent/10 px-4 py-1.5 text-[12.5px]"
    >
      <span className="shrink-0">
        <span className="font-semibold">Revio {latest}</span> is available{' '}
        <span className="text-muted">(you have {status.current})</span>
      </span>
      <UpdateButton status={status} />
      {Boolean(status.releaseUrl) && (
        <button
          type="button"
          className="btn btn-ghost no-drag shrink-0 py-0"
          onClick={() => openLink(status.releaseUrl)}
        >
          What’s new
        </button>
      )}
      <div className="flex-1" />
      {!active && (
        <button
          type="button"
          className="btn btn-ghost no-drag py-0"
          title="Hide until the next version"
          aria-label="Hide update"
          onClick={hide}
        >
          ✕
        </button>
      )}
    </div>
  )
}
