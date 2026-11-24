import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'
import { findFileInView } from './file-in-view.util.ts'

/** The Open in editor button of the file you are reading, or null when no file is on screen. */
function findOpenInEditorButton(currentFile: string | null): HTMLButtonElement | null {
  const path = findFileInView(currentFile)
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
 * The Open in editor shortcut (⌘O unless changed): opens the file you are reading, as its header's button does, so
 * the selected line and any error show there too.
 */
export function useOpenInEditorShortcut({ enabled, currentFile }: { enabled: boolean; currentFile: string | null }) {
  useShortcut('open-in-editor', () => {
    if (enabled) {
      findOpenInEditorButton(currentFile)?.click()
    }
  })
}
