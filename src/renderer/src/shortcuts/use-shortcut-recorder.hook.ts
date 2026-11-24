import { findShortcutAction, type ShortcutActionId } from '@shared/shortcut-actions.util.ts'
import { type KeyboardEvent, useState } from 'react'
import { interpretRecorderKey } from './shortcut-recorder.util.ts'
import { useShortcuts } from './shortcuts.context.ts'

/**
 * Recording other keys for an action: the keys pressed so far, what they clash with, and saving them (not while they
 * clash). `onDone` runs once they are saved or given up. Key presses stay inside the recorder, so recording never
 * sets off the shortcuts it shows.
 */
export function useShortcutRecorder(action: ShortcutActionId, onDone: () => void) {
  const { shortcuts, save, findConflict } = useShortcuts()
  const value = shortcuts[action]
  const [draft, setDraft] = useState(value)
  const start = () => setDraft(value)
  const saveShortcut = (shortcut: string) => {
    setDraft(shortcut)
    if (findConflict(action, shortcut) !== null) {
      return
    }
    if (shortcut !== value) {
      save(action, shortcut)
    }
    onDone()
  }
  const recordKey = (event: KeyboardEvent) => {
    event.stopPropagation()
    const step = interpretRecorderKey(event)
    if (step.kind === 'leave') {
      return
    }
    event.preventDefault()
    if (step.kind === 'save') {
      saveShortcut(draft)
    } else if (step.kind === 'cancel') {
      onDone()
    } else if (step.kind === 'set') {
      setDraft(step.shortcut)
    }
  }
  const { defaultShortcut } = findShortcutAction(action)
  return {
    value,
    draft,
    conflict: findConflict(action, draft),
    isDefault: draft === defaultShortcut && value === defaultShortcut,
    defaultShortcut,
    start,
    save: () => saveShortcut(draft),
    reset: () => saveShortcut(defaultShortcut),
    recordKey,
  }
}
