import { DEFAULT_GIT_LOG_SHORTCUT, findShortcutConflict } from '@shared/shortcut.util.ts'
import { useCallback, useEffect, useState } from 'react'

/**
 * The git log shortcut from Settings, read again whenever the window comes back to the front; `save` stores a new
 * one. `findConflict` names what a shortcut would clash with, counting the Open in editor shortcut you set.
 */
export function useGitLogShortcut() {
  const [shortcut, setShortcut] = useState(DEFAULT_GIT_LOG_SHORTCUT)
  const [openInEditorShortcut, setOpenInEditorShortcut] = useState('')
  useEffect(() => {
    const readSettings = () => {
      globalThis.revio
        .getSettings()
        .then((settings) => {
          setShortcut(settings.gitLogShortcut)
          setOpenInEditorShortcut(settings.openInEditorShortcut)
        })
        .catch(() => {
          // Keep the last ones; the next focus tries again.
        })
    }
    readSettings()
    globalThis.addEventListener('focus', readSettings)
    return () => globalThis.removeEventListener('focus', readSettings)
  }, [])
  const save = useCallback((next: string) => {
    setShortcut(next)
    globalThis.revio.updateSettings({ gitLogShortcut: next }).catch(() => {
      // Kept for this session; Settings shows what was stored.
    })
  }, [])
  const findConflict = useCallback(
    (candidate: string) =>
      findShortcutConflict(candidate, [{ shortcut: openInEditorShortcut, action: 'Open in editor' }]),
    [openInEditorShortcut],
  )
  return { shortcut, save, findConflict }
}
