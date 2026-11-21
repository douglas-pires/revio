import type { UpdateStatus } from '@shared/update.types.ts'
import { useEffect, useState } from 'react'

/** The latest update check, kept current by the main process's `update` events. */
export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    globalThis.revio.getUpdateStatus().then(setStatus)
    return globalThis.revio.onEvent((event) => event.type === 'update' && setStatus(event.status))
  }, [])
  return status
}
