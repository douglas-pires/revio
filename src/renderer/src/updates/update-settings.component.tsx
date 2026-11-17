import { useState } from 'react'
import { ago, errorMessage } from '../common/format.util'
import { useUpdateStatus } from './use-update-status.hook'

/** Settings row: the running version, the last check, and Check now / Download. */
export function UpdateSettings() {
  const status = useUpdateStatus()
  const [error, setError] = useState<string | null>(null)
  if (!status) return null
  const check = async () => {
    setError(null)
    try {
      await window.revio.checkForUpdates()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const problem = error ?? status.error
  return (
    <div data-update-settings className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">Revio {status.current}</div>
        <div className="text-[12px] text-muted">
          {status.checking
            ? 'Checking…'
            : problem
              ? <span className="text-danger">{problem}</span>
              : status.available
                ? `Version ${status.latest} is available.`
                : status.checkedAt
                  ? `Up to date · checked ${ago(status.checkedAt)} ago`
                  : 'Not checked yet. Installed builds check every few hours.'}
        </div>
      </div>
      {status.available && (
        <button className="btn btn-primary" onClick={() => void window.revio.openExternal(status.downloadUrl ?? status.releaseUrl!)}>
          Download {status.latest}
        </button>
      )}
      <button className="btn" disabled={status.checking} onClick={() => void check()}>
        Check for updates
      </button>
    </div>
  )
}
