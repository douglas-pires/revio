import { useState } from 'react'
import type { UpdateStatus } from '@shared/update.types'

const DISMISSED_KEY = 'revio.dismissedUpdate'

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/** A slim bar when a newer Revio is out. Hiding it hides that version only. */
export function UpdateBanner({ status }: { status: UpdateStatus | null }) {
  const [dismissed, setDismissed] = useState(readDismissed)
  if (!status?.available || !status.latest || dismissed === status.latest) return null
  const latest = status.latest
  const hide = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, latest)
    } catch {
      // Not remembered; it hides until the app restarts.
    }
    setDismissed(latest)
  }
  return (
    <div data-update-banner className="drag flex shrink-0 items-center gap-3 border-b border-accent/40 bg-accent/10 px-4 py-1.5 text-[12.5px]">
      <span>
        <span className="font-semibold">Revio {latest}</span> is available <span className="text-muted">(you have {status.current})</span>
      </span>
      <button className="btn btn-primary no-drag py-0" onClick={() => void window.revio.openExternal(status.downloadUrl ?? status.releaseUrl!)}>
        Download
      </button>
      {status.releaseUrl && (
        <button className="btn btn-ghost no-drag py-0" onClick={() => void window.revio.openExternal(status.releaseUrl!)}>
          What’s new
        </button>
      )}
      <div className="flex-1" />
      <button className="btn btn-ghost no-drag py-0" title="Hide until the next version" aria-label="Hide update" onClick={hide}>
        ✕
      </button>
    </div>
  )
}
