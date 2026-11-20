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

const LETTER_OR_DIGIT = /^(?:Key(?<letter>[A-Z])|Digit(?<digit>\d))$/u
const COMMAND_MODIFIER = /^(?:Cmd|Ctrl|Alt)\+/u

/**
 * The key itself, apart from modifiers. Letters and digits come from the physical key, because Option and Shift
 * change `key` ("ø" for Option+O, "!" for Shift+1).
 */
function baseKey({ key, code }: Pick<KeyPress, 'key' | 'code'>): string {
  const m = LETTER_OR_DIGIT.exec(code)
  if (m) {
    return m.groups?.letter ?? m.groups?.digit ?? key
  }
  if (key.length === 1) {
    return key.toUpperCase()
  }
  return key
}

/** A shortcut's parts. A trailing "+" is the plus key itself, not a separator. */
function partsOf(shortcut: string) {
  if (shortcut.endsWith('++')) {
    return [...shortcut.slice(0, -2).split('+'), '+']
  }
  return shortcut.split('+')
}

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
export function shortcutOf(press: KeyPress): string | null {
  if (MODIFIER_KEYS.has(press.key)) {
    return null
  }
  const mods = MODIFIERS.filter(([, flag]) => press[flag]).map(([name]) => name)
  return [...mods, baseKey(press)].join('+')
}

/** Whether a key press is `shortcut`. An empty shortcut matches nothing. */
export function matchesShortcut(press: KeyPress, shortcut: string): boolean {
  return shortcut !== '' && shortcutOf(press) === shortcut
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
  return partsOf(shortcut)
    .map((p) => SYMBOLS[p] ?? p)
    .join('')
}
