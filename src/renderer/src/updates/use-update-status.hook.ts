import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/update.types'

/** The latest update check, kept current by the main process's `update` events. */
export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    void window.revio.getUpdateStatus().then(setStatus)
    return window.revio.onEvent((e) => e.type === 'update' && setStatus(e.status))
  }, [])
  return status
}
