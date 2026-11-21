import type { SyncStatus } from '@shared/settings.types.ts'
import { useEffect, useState } from 'react'

/** The latest sync, kept current by the main process's `sync` events; `onApplied` runs when another Mac's changes came in. */
export function useSyncStatus(onApplied: () => void) {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  useEffect(() => {
    globalThis.revio.getSyncStatus().then(setStatus)
    return globalThis.revio.onEvent((event) => {
      if (event.type !== 'sync') {
        return
      }
      setStatus(event.status)
      if (event.applied) {
        onApplied()
      }
    })
  }, [onApplied])
  return status
}
