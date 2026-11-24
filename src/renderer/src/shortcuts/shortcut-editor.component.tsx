import { formatShortcut } from '@shared/shortcut.util.ts'
import { findShortcutAction, type ShortcutActionId } from '@shared/shortcut-actions.util.ts'
import { useCallback, useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { ShortcutPopover } from './shortcut-popover.component.tsx'
import { useShortcuts } from './shortcuts.context.ts'

/** An action's keys: click them to choose others in a popover, placed by `popoverClassName`. */
export function ShortcutEditor({
  action,
  className,
  popoverClassName,
}: {
  action: ShortcutActionId
  className?: string
  popoverClassName: string
}) {
  const { shortcuts, save, findConflict } = useShortcuts()
  const [editing, setEditing] = useState(false)
  const close = useCallback(() => setEditing(false), [])
  const { label, defaultShortcut } = findShortcutAction(action)
  return (
    <span className={joinClassNames('relative', className)}>
      <button
        type="button"
        className="kbd cursor-pointer hover:border-accent hover:text-fg"
        title={`Change the shortcut: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={editing}
        data-shortcut={action}
        onClick={() => setEditing(!editing)}
      >
        {formatShortcut(shortcuts[action]) || 'Off'}
      </button>
      {Boolean(editing) && (
        <ShortcutPopover
          className={popoverClassName}
          title={label}
          value={shortcuts[action]}
          defaultValue={defaultShortcut}
          findConflict={(shortcut) => findConflict(action, shortcut)}
          onSave={(shortcut) => save(action, shortcut)}
          onClose={close}
        />
      )}
    </span>
  )
}
