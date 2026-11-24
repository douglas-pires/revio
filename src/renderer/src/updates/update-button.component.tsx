import type { UpdateStatus } from '@shared/update.types.ts'
import { useState } from 'react'
import { countOf } from '../common/format.util.ts'
import { countUnsentComments } from '../pull/unsent-comments.util.ts'
import { downloadLinkOf, openLink } from './update-links.util.ts'

/** The dmg, for a copy of Revio that cannot replace itself or whose update failed. */
function DownloadButton({ status, className }: { status: UpdateStatus; className: string }) {
  return (
    <button type="button" className={className} onClick={() => openLink(downloadLinkOf(status))}>
      Download {status.latest}
    </button>
  )
}

/** How much of the update has been downloaded. */
function DownloadProgress({ percent }: { percent: number }) {
  return (
    <span className="no-drag flex items-center gap-2 text-[12px] text-muted">
      <progress
        className="h-1.5 w-32 appearance-none overflow-hidden rounded [&::-webkit-progress-bar]:bg-panel-2 [&::-webkit-progress-value]:bg-accent"
        max={100}
        value={percent}
        aria-label="Downloading"
      />
      Downloading {percent}%
    </span>
  )
}

/** Asks before a restart that would lose comments left unsent, which are kept only while Revio runs. */
function ConfirmRestart({ unsentCount, onCancel }: { unsentCount: number; onCancel: () => void }) {
  return (
    <span className="no-drag flex items-center gap-2 text-[12px]">
      <span className="text-warn">{countOf(unsentCount, 'unsent comment', 'unsent comments')} will be lost.</span>
      <button type="button" className="btn py-0 text-danger" onClick={() => globalThis.revio.restartToUpdate()}>
        Restart anyway
      </button>
      <button type="button" className="btn btn-ghost py-0" onClick={onCancel}>
        Cancel
      </button>
    </span>
  )
}

function RestartButton({ className }: { className: string }) {
  const [unsentCount, setUnsentCount] = useState(0)
  if (unsentCount > 0) {
    return <ConfirmRestart unsentCount={unsentCount} onCancel={() => setUnsentCount(0)} />
  }
  const restart = () => {
    const count = countUnsentComments()
    if (count > 0) {
      setUnsentCount(count)
    } else {
      globalThis.revio.restartToUpdate()
    }
  }
  return (
    <button type="button" className={className} title="Or quit Revio: it is installed then too" onClick={restart}>
      Restart to update
    </button>
  )
}

/** Why the update failed, trying again, and the dmg. */
function FailedUpdate({ status, message }: { status: UpdateStatus; message: string }) {
  return (
    <span className="no-drag flex min-w-0 items-center gap-2 text-[12px]">
      <span className="min-w-0 truncate text-danger" title={message}>
        Could not update: {message}
      </span>
      <button type="button" className="btn shrink-0 py-0" onClick={() => globalThis.revio.downloadUpdate()}>
        Try again
      </button>
      <DownloadButton status={status} className="btn btn-ghost shrink-0 py-0" />
    </span>
  )
}

/** Installs the available update: Update, then its progress, then Restart to update. */
export function UpdateButton({ status }: { status: UpdateStatus }) {
  const { install } = status
  const className = 'btn btn-primary no-drag shrink-0 py-0'
  if (install.phase === 'unsupported') {
    return <DownloadButton status={status} className={className} />
  }
  if (install.phase === 'downloading') {
    return <DownloadProgress percent={install.percent} />
  }
  if (install.phase === 'ready') {
    return <RestartButton className={className} />
  }
  if (install.phase === 'failed') {
    return <FailedUpdate status={status} message={install.message} />
  }
  return (
    <button type="button" className={className} onClick={() => globalThis.revio.downloadUpdate()}>
      Update
    </button>
  )
}
