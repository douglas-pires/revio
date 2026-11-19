import type { UpdateStatus } from '@shared/update.types.ts'
import { useState } from 'react'
import { ago, errorMessage } from '../common/format.util.ts'
import { downloadLinkOf, openLink } from './update-links.util.ts'
import { useUpdateStatus } from './use-update-status.hook.ts'

/** What the last check found: checking, a problem, a new version, up to date, or not checked yet. */
function UpdateState({ status, problem }: { status: UpdateStatus; problem: string | null }) {
  if (status.checking) {
    return 'Checking…'
  }
  if (problem) {
    return <span className="text-danger">{problem}</span>
  }
  if (status.available) {
    return `Version ${status.latest} is available.`
  }
  if (status.checkedAt) {
    return `Up to date · checked ${ago(status.checkedAt)} ago`
  }
  return 'Not checked yet. Installed builds check every few hours.'
}

/** Settings row: the running version, the last check, and Check now / Download. */
export function UpdateSettings() {
  const status = useUpdateStatus()
  const [error, setError] = useState<string | null>(null)
  if (!status) {
    return null
  }
  const check = async () => {
    setError(null)
    try {
      await globalThis.revio.checkForUpdates()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const problem = error ?? status.error
  return (
    <div data-update-settings={true} className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">Revio {status.current}</div>
        <div className="text-[12px] text-muted">
          <UpdateState status={status} problem={problem} />
        </div>
      </div>
      {Boolean(status.available) && (
        <button type="button" className="btn btn-primary" onClick={() => openLink(downloadLinkOf(status))}>
          Download {status.latest}
        </button>
      )}
      <button type="button" className="btn" disabled={status.checking} onClick={() => check()}>
        Check for updates
      </button>
    </div>
  )
}
