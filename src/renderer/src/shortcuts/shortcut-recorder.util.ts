import { type KeyPress, readShortcut } from '@shared/shortcut.util.ts'

/** What a key press does while a shortcut is recorded. */
export type RecorderStep =
  | { kind: 'save' }
  | { kind: 'cancel' }
  | { kind: 'set'; shortcut: string }
  | { kind: 'wait' }
  | { kind: 'leave' }

/** What these keys do when pressed without a modifier. */
const STEPS_ALONE: Record<string, RecorderStep> = {
  Enter: { kind: 'save' },
  Escape: { kind: 'cancel' },
  Backspace: { kind: 'set', shortcut: '' },
  Delete: { kind: 'set', shortcut: '' },
  Tab: { kind: 'leave' },
}

/** Enter saves, Escape cancels, Backspace or Delete turn it off, Tab moves on; a lone modifier waits for more keys. */
export function interpretRecorderKey(press: KeyPress): RecorderStep {
  const hasModifier = press.metaKey || press.ctrlKey || press.altKey
  const alone = STEPS_ALONE[press.key]
  if (alone && !hasModifier) {
    return alone
  }
  const shortcut = readShortcut(press)
  if (shortcut === null) {
    return { kind: 'wait' }
  }
  return { kind: 'set', shortcut }
}
