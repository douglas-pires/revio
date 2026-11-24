import { useSyncExternalStore } from 'react'
import { readNotice, watchNotice } from './notice.service.ts'

/** Where notices appear: centred near the bottom of the window, over everything, and out of the way of clicks. */
export function Notice() {
  const text = useSyncExternalStore(watchNotice, readNotice)
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-12 z-50 flex justify-center">
      {text !== null && (
        <span className="max-w-[80vw] truncate rounded-md border border-line bg-panel-2 px-3 py-1.5 text-[12px] shadow-lg">
          {text}
        </span>
      )}
    </div>
  )
}
