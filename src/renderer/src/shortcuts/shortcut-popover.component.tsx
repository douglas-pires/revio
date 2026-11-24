import { formatShortcut, type KeyPress, readShortcut } from '@shared/shortcut.util.ts'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'

/** What a key press does in the recorder. */
type RecorderStep = { kind: 'save' } | { kind: 'cancel' } | { kind: 'set'; shortcut: string } | { kind: 'wait' }

/** Enter saves and Escape cancels (both alone); Backspace or Delete turn it off; a lone modifier waits for more keys. */
function interpretKey(press: KeyPress): RecorderStep {
  const alone = !(press.metaKey || press.ctrlKey || press.altKey || press.shiftKey)
  if (alone && press.key === 'Enter') {
    return { kind: 'save' }
  }
  if (alone && press.key === 'Escape') {
    return { kind: 'cancel' }
  }
  if (alone && (press.key === 'Backspace' || press.key === 'Delete')) {
    return { kind: 'set', shortcut: '' }
  }
  const shortcut = readShortcut(press)
  if (shortcut === null) {
    return { kind: 'wait' }
  }
  return { kind: 'set', shortcut }
}

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

/** What the recorder says under the keys: the clash in red, else how to use it. */
function RecorderHint({ conflict }: { conflict: string | null }) {
  if (conflict) {
    return <p className="text-[11.5px] text-danger">Already used for {conflict}.</p>
  }
  return <p className="text-[11.5px] text-muted">Press the keys. Enter saves, Esc cancels, ⌫ turns it off.</p>
}

/**
 * A small popover to change a shortcut: press the new keys, see right away whether they clash with another
 * shortcut (in red, and then it cannot be saved), and press Enter or Save to keep them, or reset to the default.
 * Key presses stay inside it, so recording never sets off the shortcuts it shows.
 */
export function ShortcutPopover(props: {
  title: string
  value: string
  defaultValue: string
  findConflict: (shortcut: string) => string | null
  onSave: (shortcut: string) => void
  onClose: () => void
  className?: string
}) {
  const [draft, setDraft] = useState(props.value)
  const popover = useCloseOnOutsidePress(props.onClose)
  const conflict = props.findConflict(draft)
  const save = (shortcut: string) => {
    if (props.findConflict(shortcut) !== null) {
      return
    }
    if (shortcut !== props.value) {
      props.onSave(shortcut)
    }
    props.onClose()
  }
  const recordKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const step = interpretKey(event)
    if (step.kind === 'save') {
      save(draft)
    } else if (step.kind === 'cancel') {
      props.onClose()
    } else if (step.kind === 'set') {
      setDraft(step.shortcut)
    }
  }
  return (
    <div
      ref={popover}
      role="dialog"
      aria-label={props.title}
      className={joinClassNames(
        'space-y-2 rounded-lg border border-line bg-panel p-3 text-[12px] shadow-lg',
        props.className,
      )}
    >
      <div className="font-semibold text-fg">{props.title}</div>
      <button
        type="button"
        // biome-ignore lint/a11y/noAutofocus: the popover opens to record keys, so the recorder takes the keys at once.
        autoFocus={true}
        aria-invalid={conflict !== null}
        aria-label={`${props.title}: press the keys`}
        className={joinClassNames(
          'input text-left font-mono',
          conflict !== null && 'border-danger text-danger focus:border-danger',
        )}
        onKeyDown={recordKey}
      >
        {formatShortcut(draft) || 'Off'}
      </button>
      <RecorderHint conflict={conflict} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={draft === props.defaultValue && props.value === props.defaultValue}
          onClick={() => {
            setDraft(props.defaultValue)
            save(props.defaultValue)
          }}
        >
          Reset to {formatShortcut(props.defaultValue)}
        </button>
        <div className="flex-1" />
        <button type="button" className="btn" disabled={conflict !== null} onClick={() => save(draft)}>
          Save
        </button>
      </div>
    </div>
  )
}
