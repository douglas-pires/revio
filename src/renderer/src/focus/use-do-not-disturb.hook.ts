import { useEffect } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { showNotice } from '../common/notice.service.ts'

/** Keeps Do Not Disturb on while `on` (a block is running), through the shortcuts chosen in Settings. */
export function useDoNotDisturb(on: boolean) {
  useEffect(() => {
    globalThis.revio.setDoNotDisturb(on).catch((failure) => showNotice(readErrorMessage(failure)))
  }, [on])
}
