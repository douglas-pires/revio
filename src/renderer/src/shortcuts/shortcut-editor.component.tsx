import { formatShortcut } from '@shared/shortcut.util.ts'
import { findShortcutAction, type ShortcutActionId } from '@shared/shortcut-actions.util.ts'
import { useCallback, useState } from 'react'
import { ShortcutPopover } from './shortcut-popover.component.tsx'
import { useShortcuts } from './shortcuts.context.ts'

/** An action's keys where there is no room to record in place: click them to choose others in a popover above. */
export function ShortcutEditor({ action }: { action: ShortcutActionId }) {
  const { shortcuts } = useShortcuts()
  const [editing, setEditing] = useState(false)
  const close = useCallback(() => setEditing(false), [])
  return (
    <span className="relative">
      <button
        type="button"
        className="kbd cursor-pointer hover:border-accent hover:text-fg"
        title={`Change the shortcut: ${findShortcutAction(action).label}`}
        aria-haspopup="dialog"
        aria-expanded={editing}
        data-shortcut={action}
        onClick={() => setEditing(!editing)}
      >
        {formatShortcut(shortcuts[action]) || 'Off'}
      </button>
      {Boolean(editing) && (
        <ShortcutPopover action={action} className="absolute bottom-full left-0 z-30 mb-2 w-72" onClose={close} />
      )}
    </span>
  )
}
