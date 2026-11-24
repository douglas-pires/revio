import { useState } from 'react'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'

/** Its shortcut (⌘P) opens the quick file list and switches to Files changed; pressed again while open, it closes it. */
export function useQuickOpen(showFiles: () => void) {
  const [open, setOpen] = useState(false)
  const toggle = () => {
    showFiles()
    setOpen(!open)
  }
  useShortcut('quick-open', toggle, { overDialogs: open })
  return { open, close: () => setOpen(false) }
}
