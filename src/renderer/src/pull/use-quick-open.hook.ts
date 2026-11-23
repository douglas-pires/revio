import { useEffect, useState } from 'react'

/** Whether ⌘P is exactly what was pressed (no Shift, Option or Control). */
const isQuickOpenKey = (event: KeyboardEvent) =>
  event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey && event.code === 'KeyP'

/** ⌘P opens the quick file list (and switches to Files changed); pressing it again while open closes it. */
export function useQuickOpen(showFiles: () => void) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || !isQuickOpenKey(event)) {
        return
      }
      event.preventDefault()
      showFiles()
      setOpen((wasOpen) => !wasOpen)
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [showFiles])
  return { open, close: () => setOpen(false) }
}
