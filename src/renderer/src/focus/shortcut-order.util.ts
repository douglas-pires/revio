/** Words in a shortcut's name that suggest it changes Focus or Do Not Disturb. */
const FOCUS_WORDS = /focus|dnd|disturb/i

/** Your shortcuts with the ones that look like Focus or Do Not Disturb first, each group in its own order. */
export function orderFocusShortcutsFirst(names: string[]) {
  const likely = names.filter((name) => FOCUS_WORDS.test(name))
  const others = names.filter((name) => !FOCUS_WORDS.test(name))
  return [...likely, ...others]
}
