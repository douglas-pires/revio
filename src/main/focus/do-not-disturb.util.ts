/** The two shortcuts that turn Do Not Disturb on and off; "" for none. */
export interface DoNotDisturbShortcuts {
  dndOnShortcut: string
  dndOffShortcut: string
}

/** The shortcut names `shortcuts list` printed, one per line. */
export function parseShortcutList(output: string) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Which shortcut to run to make Do Not Disturb match `on`, given whether Revio turned it on: none when it already
 * matches, when no shortcut is chosen, or when turning off what Revio never turned on (you may have turned it on
 * yourself).
 */
export function pickShortcutToRun(on: boolean, turnedOn: boolean, shortcuts: DoNotDisturbShortcuts) {
  if (on === turnedOn) {
    return null
  }
  if (on) {
    return shortcuts.dndOnShortcut || null
  }
  return shortcuts.dndOffShortcut || null
}
