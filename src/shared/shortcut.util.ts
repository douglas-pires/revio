/** Modifiers in the order shortcuts are written: "Cmd+Shift+O". */
const MODIFIERS = [
  ['Cmd', 'metaKey'],
  ['Ctrl', 'ctrlKey'],
  ['Alt', 'altKey'],
  ['Shift', 'shiftKey'],
] as const

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'CapsLock', 'Fn'])

/** macOS symbols for each part, for showing a shortcut. */
const SYMBOLS: Record<string, string> = {
  Cmd: '⌘',
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Enter: '↩',
  Escape: '⎋',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': 'Space',
}

/** Shortcuts Revio or macOS already use, and what for; a new shortcut on one of them would clash. */
const RESERVED_SHORTCUTS: Record<string, string> = {
  'Cmd+F': 'Find in the changed files',
  'Cmd+P': 'Go to a changed file',
  'Cmd+G': 'Next find match',
  'Cmd+Shift+G': 'Previous find match',
  'Cmd+Enter': 'Send a comment or review',
  J: 'Next file',
  K: 'Previous file',
  V: 'Mark the file viewed',
  '/': 'Search',
  'Cmd+C': 'Copy',
  'Cmd+V': 'Paste',
  'Cmd+X': 'Cut',
  'Cmd+A': 'Select all',
  'Cmd+Z': 'Undo',
  'Cmd+Shift+Z': 'Redo',
  'Cmd+Q': 'Quit Revio',
  'Cmd+W': 'Close the window',
  'Cmd+H': 'Hide Revio',
  'Cmd+M': 'Minimize the window',
  'Cmd+R': 'Reload',
  'Cmd+,': 'Settings',
}

const LETTER_OR_DIGIT = /^(?:Key(?<letter>[A-Z])|Digit(?<digit>\d))$/u
const COMMAND_MODIFIER = /^(?:Cmd|Ctrl|Alt)\+/u

/**
 * The key itself, apart from modifiers. Letters and digits come from the physical key, because Option and Shift
 * change `key` ("ø" for Option+O, "!" for Shift+1).
 */
function readBaseKey({ key, code }: Pick<KeyPress, 'key' | 'code'>): string {
  const letterOrDigit = LETTER_OR_DIGIT.exec(code)
  if (letterOrDigit) {
    return letterOrDigit.groups?.letter ?? letterOrDigit.groups?.digit ?? key
  }
  if (key.length === 1) {
    return key.toUpperCase()
  }
  return key
}

/** A shortcut's parts. A trailing "+" is the plus key itself, not a separator. */
function splitShortcut(shortcut: string) {
  if (shortcut.endsWith('++')) {
    return [...shortcut.slice(0, -2).split('+'), '+']
  }
  return shortcut.split('+')
}

/** The Open in editor shortcut until you change it in Settings. */
export const DEFAULT_OPEN_IN_EDITOR_SHORTCUT = 'Cmd+O'

/** The Git log panel shortcut until you change it. */
export const DEFAULT_GIT_LOG_SHORTCUT = 'Ctrl+G'

/** The parts of a key press a shortcut is made of (a DOM KeyboardEvent has them all). */
export interface KeyPress {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/** The shortcut a key press makes, like "Cmd+O"; null for a lone modifier, which is not a shortcut yet. */
export function readShortcut(press: KeyPress): string | null {
  if (MODIFIER_KEYS.has(press.key)) {
    return null
  }
  const modifiers = MODIFIERS.filter(([, flag]) => press[flag]).map(([name]) => name)
  return [...modifiers, readBaseKey(press)].join('+')
}

/** Whether a key press is `shortcut`. An empty shortcut matches nothing. */
export function matchesShortcut(press: KeyPress, shortcut: string): boolean {
  return shortcut !== '' && readShortcut(press) === shortcut
}

/** Whether the shortcut uses Cmd, Ctrl or Alt, so it can fire while you type without inserting text. */
export function hasCommandModifier(shortcut: string): boolean {
  return COMMAND_MODIFIER.test(shortcut)
}

/** The shortcut as macOS shows it: "Cmd+Shift+O" reads "⌘⇧O". */
export function formatShortcut(shortcut: string): string {
  if (!shortcut) {
    return ''
  }
  return splitShortcut(shortcut)
    .map((part) => SYMBOLS[part] ?? part)
    .join('')
}

/** Another shortcut you have set, by what it does. */
export interface TakenShortcut {
  shortcut: string
  action: string
}

/**
 * What `shortcut` would clash with: one of Revio's or macOS's own shortcuts, or another one you have set (`taken`).
 * Null when it is free, or empty (off).
 */
export function findShortcutConflict(shortcut: string, taken: readonly TakenShortcut[]): string | null {
  if (!shortcut) {
    return null
  }
  const setByYou = taken.find((candidate) => candidate.shortcut === shortcut)
  return setByYou?.action ?? RESERVED_SHORTCUTS[shortcut] ?? null
}
