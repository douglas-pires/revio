import { hasCommandModifier, matchesShortcut } from '@shared/shortcut.util.ts'
import { useEffect, useRef, useState } from 'react'
import { isTyping } from '../common/keyboard.util.ts'
import { fileInView } from './file-in-view.util.ts'

interface ShortcutState {
  enabled: boolean
  currentFile: string | null
  shortcut: string
}

/** The shortcut from Settings, read again whenever the window comes back to the front (after changing it, say). */
function useEditorShortcutSetting() {
  const [shortcut, setShortcut] = useState('')
  useEffect(() => {
    const readShortcutSetting = () => {
      globalThis.revio
        .getSettings()
        .then((settings) => setShortcut(settings.openInEditorShortcut))
        .catch(() => {
          // Keep the last one; the next focus tries again.
        })
    }
    readShortcutSetting()
    globalThis.addEventListener('focus', readShortcutSetting)
    return () => globalThis.removeEventListener('focus', readShortcutSetting)
  }, [])
  return shortcut
}

/** Whether this key press is the shortcut, and allowed here: in a text field only with Cmd, Ctrl or Alt. */
function isShortcutPress(event: KeyboardEvent, state: ShortcutState) {
  if (!(state.enabled && matchesShortcut(event, state.shortcut)) || event.repeat) {
    return false
  }
  return !isTyping(event.target) || hasCommandModifier(state.shortcut)
}

/** The Open in editor button of the file you are reading, or null when no file is on screen. */
function findOpenInEditorButton(currentFile: string | null): HTMLButtonElement | null {
  const path = fileInView(currentFile)
  if (!path) {
    return null
  }
  const button = document.querySelector(`#${CSS.escape(`file-${path}`)} [data-open-in-editor]`)
  if (button instanceof HTMLButtonElement) {
    return button
  }
  return null
}

/**
 * The Open in editor shortcut (Cmd+O unless changed in Settings): opens the file you are reading, as its header's
 * button does, so the selected line and any error show there too. Inside a text field it fires only with Cmd,
 * Ctrl or Alt, so a plain-letter shortcut never eats what you type.
 */
export function useOpenInEditorShortcut({ enabled, currentFile }: { enabled: boolean; currentFile: string | null }) {
  const shortcut = useEditorShortcutSetting()
  const latestState = useRef<ShortcutState>({ enabled, currentFile, shortcut })
  latestState.current = { enabled, currentFile, shortcut }

  useEffect(() => {
    const openFileOnShortcut = (event: KeyboardEvent) => {
      if (!isShortcutPress(event, latestState.current)) {
        return
      }
      const button = findOpenInEditorButton(latestState.current.currentFile)
      if (button) {
        event.preventDefault()
        button.click()
      }
    }
    globalThis.addEventListener('keydown', openFileOnShortcut)
    return () => globalThis.removeEventListener('keydown', openFileOnShortcut)
  }, [])
}
