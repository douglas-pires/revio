import { hasCommandModifier, matchesShortcut } from '@shared/shortcut.util.ts'
import { useEffect, useRef, useState } from 'react'
import { isTyping } from '../common/keyboard.util.ts'
import { fileInView } from './file-in-view.util.ts'

/** The shortcut from Settings, read again whenever the window comes back to the front (after changing it, say). */
function useEditorShortcut() {
  const [shortcut, setShortcut] = useState('')
  useEffect(() => {
    const read = () => {
      globalThis.revio
        .getSettings()
        .then((s) => setShortcut(s.openInEditorShortcut))
        .catch(() => {
          // Keep the last one; the next focus tries again.
        })
    }
    read()
    globalThis.addEventListener('focus', read)
    return () => globalThis.removeEventListener('focus', read)
  }, [])
  return shortcut
}

/**
 * The Open in editor shortcut (Cmd+O unless changed in Settings): opens the file you are reading, as its header's
 * button does, so the selected line and any error show there too. Inside a text field it fires only with Cmd,
 * Ctrl or Alt, so a plain-letter shortcut never eats what you type.
 */
export function useOpenInEditorShortcut({ enabled, current }: { enabled: boolean; current: string | null }) {
  const shortcut = useEditorShortcut()
  const latest = useRef({ enabled, current, shortcut })
  latest.current = { enabled, current, shortcut }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = latest.current
      if (!(s.enabled && matchesShortcut(e, s.shortcut)) || e.repeat) {
        return
      }
      if (isTyping(e.target) && !hasCommandModifier(s.shortcut)) {
        return
      }
      const path = fileInView(s.current)
      const button = path && document.querySelector(`#${CSS.escape(`file-${path}`)} [data-open-in-editor]`)
      if (!(button instanceof HTMLButtonElement)) {
        return
      }
      e.preventDefault()
      button.click()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])
}
