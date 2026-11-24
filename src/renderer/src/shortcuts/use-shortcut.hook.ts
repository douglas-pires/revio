import { hasCommandModifier, matchesShortcut } from '@shared/shortcut.util.ts'
import type { ShortcutActionId } from '@shared/shortcut-actions.util.ts'
import { useEffect, useRef } from 'react'
import { isTyping } from '../common/keyboard.util.ts'
import { useShortcuts } from './shortcuts.context.ts'

interface ShortcutOptions {
  /** Holding the keys runs it again and again. */
  repeats?: boolean
  /** Works while a modal dialog is open, such as the one it opens. */
  overDialogs?: boolean
}

/** A plain-letter shortcut never eats what you type, and shortcuts rest while a dialog has the screen. */
function isAllowedHere(event: KeyboardEvent, shortcut: string, options: ShortcutOptions) {
  if (event.repeat && !options.repeats) {
    return false
  }
  if (!options.overDialogs && document.querySelector('dialog[open]')) {
    return false
  }
  return !isTyping(event.target) || hasCommandModifier(shortcut)
}

/** Runs `run` on the action's shortcut while the component is on screen; null turns it off. */
export function useShortcut(id: ShortcutActionId, run: (() => void) | null, options: ShortcutOptions = {}) {
  const shortcut = useShortcuts().shortcuts[id]
  const latest = useRef({ run, options, shortcut })
  latest.current = { run, options, shortcut }
  useEffect(() => {
    const runOnShortcut = (event: KeyboardEvent) => {
      const { current } = latest
      if (!(current.run && matchesShortcut(event, current.shortcut))) {
        return
      }
      if (isAllowedHere(event, current.shortcut, current.options)) {
        event.preventDefault()
        current.run()
      }
    }
    globalThis.addEventListener('keydown', runOnShortcut)
    return () => globalThis.removeEventListener('keydown', runOnShortcut)
  }, [])
}
