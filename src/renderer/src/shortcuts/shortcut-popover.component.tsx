import { formatShortcut } from '@shared/shortcut.util.ts'
import { findShortcutAction, type ShortcutActionId } from '@shared/shortcut-actions.util.ts'
import { useEffect, useRef } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { RecorderHint } from './recorder-hint.component.tsx'
import { useShortcutRecorder } from './use-shortcut-recorder.hook.ts'

/** Closes the popover on a press outside it. */
function useCloseOnOutsidePress(onClose: () => void) {
  const popover = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (popover.current && !popover.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [onClose])
  return popover
}

/**
 * A small popover to change an action's shortcut: press the new keys, see right away whether they clash with another
 * shortcut (in red, and then they cannot be saved), and press Enter or Save to keep them, or reset to the default.
 */
export function ShortcutPopover(props: { action: ShortcutActionId; onClose: () => void; className?: string }) {
  const popover = useCloseOnOutsidePress(props.onClose)
  const recorder = useShortcutRecorder(props.action, props.onClose)
  const { label } = findShortcutAction(props.action)
  const clashes = recorder.conflict !== null
  return (
    <div
      ref={popover}
      role="dialog"
      aria-label={label}
      className={joinClassNames(
        'space-y-2 rounded-lg border border-line bg-panel p-3 text-[12px] shadow-lg',
        props.className,
      )}
    >
      <div className="font-semibold text-fg">{label}</div>
      <input
        readOnly={true}
        // biome-ignore lint/a11y/noAutofocus: the popover opens to record keys, so the recorder takes the keys at once.
        autoFocus={true}
        aria-invalid={clashes}
        aria-label={`${label}: press the keys`}
        className={joinClassNames('input font-mono', clashes && 'border-danger text-danger focus:border-danger')}
        value={formatShortcut(recorder.draft) || 'Off'}
        onKeyDown={recorder.recordKey}
      />
      <RecorderHint conflict={recorder.conflict} />
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-ghost" disabled={recorder.isDefault} onClick={recorder.reset}>
          Reset to {formatShortcut(recorder.defaultShortcut)}
        </button>
        <div className="flex-1" />
        <button type="button" className="btn" disabled={clashes} onClick={recorder.save}>
          Save
        </button>
      </div>
    </div>
  )
}
