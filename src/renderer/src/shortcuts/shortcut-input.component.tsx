import { formatShortcut } from '@shared/shortcut.util.ts'
import { findShortcutAction, type ShortcutActionId } from '@shared/shortcut-actions.util.ts'
import { useRef, useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { RecorderHint } from './recorder-hint.component.tsx'
import { useShortcutRecorder } from './use-shortcut-recorder.hook.ts'

/**
 * An action's keys, in an input that records others in place: focus it and press them. A clash turns the input red,
 * says what uses the keys, and cannot be saved. Leaving the input gives up the keys not saved.
 */
export function ShortcutInput({ action }: { action: ShortcutActionId }) {
  const input = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState(false)
  const recorder = useShortcutRecorder(action, () => input.current?.blur())
  let shown = recorder.value
  if (recording) {
    shown = recorder.draft
  }
  const clashes = recording && recorder.conflict !== null
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {Boolean(recording && !recorder.isDefault) && (
          <button
            type="button"
            className="btn btn-ghost py-0 text-[11.5px]"
            // On mouse down, so the input keeps the focus and stays open when the default clashes.
            onMouseDown={(event) => {
              event.preventDefault()
              recorder.reset()
            }}
          >
            Reset to {formatShortcut(recorder.defaultShortcut)}
          </button>
        )}
        <input
          ref={input}
          readOnly={true}
          data-shortcut={action}
          aria-label={`Shortcut: ${findShortcutAction(action).label}`}
          aria-invalid={clashes}
          className={joinClassNames(
            'input w-28 cursor-pointer py-0.5 text-center font-mono text-[12px]',
            clashes && 'border-danger text-danger focus:border-danger',
          )}
          value={formatShortcut(shown) || 'Off'}
          onFocus={() => {
            recorder.start()
            setRecording(true)
          }}
          onBlur={() => setRecording(false)}
          onKeyDown={recorder.recordKey}
        />
      </div>
      {Boolean(recording) && <RecorderHint conflict={recorder.conflict} />}
    </div>
  )
}
