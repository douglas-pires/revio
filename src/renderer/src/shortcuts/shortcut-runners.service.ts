import type { ShortcutActionId } from '@shared/shortcut-actions.util.ts'

type Run = () => void

/** What each action would do now, by action; the last screen to offer one wins. */
const runners = new Map<ShortcutActionId, Run>()

export function addShortcutRunner(id: ShortcutActionId, run: Run) {
  runners.set(id, run)
  return () => {
    if (runners.get(id) === run) {
      runners.delete(id)
    }
  }
}

/** Does what the action's shortcut would, if a screen offers it. */
export function runShortcut(id: ShortcutActionId) {
  runners.get(id)?.()
}
