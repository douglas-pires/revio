import { useEffect, useRef, useState } from 'react'
import { PanelHeader } from '../common/panel-header.component.tsx'
import { ShortcutList } from './shortcut-list.component.tsx'
import { useShortcut } from './use-shortcut.hook.ts'

function OpenDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-label="Shortcuts"
      className="m-auto w-[min(560px,90vw)] overflow-hidden rounded-lg border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/40"
      onClose={onClose}
      onMouseDown={(event) => event.target === event.currentTarget && dialog.current?.close()}
    >
      <PanelHeader title="Shortcuts" onClose={() => dialog.current?.close()} closeLabel="Close" />
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <ShortcutList />
      </div>
    </dialog>
  )
}

/** The list of shortcuts, opened and closed by its own shortcut from anywhere. */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false)
  useShortcut('show-shortcuts', () => setOpen(!open), { overDialogs: true })
  if (!open) {
    return null
  }
  return <OpenDialog onClose={() => setOpen(false)} />
}
