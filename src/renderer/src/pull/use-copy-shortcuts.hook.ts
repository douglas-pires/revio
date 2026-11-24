import type { PullDetail } from '@shared/pull.types.ts'
import { copyText } from '../common/copy-text.service.ts'
import { showNotice } from '../common/notice.service.ts'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'
import { findFileInView } from './file-in-view.util.ts'

/** Copies the path of the file you are reading; says so when there is none. */
function copyFilePath(currentFile: string | null) {
  const path = findFileInView(currentFile)
  if (path) {
    copyText(path)
  } else {
    showNotice('No file selected')
  }
}

/** Shortcuts copy the PR's branch name (⌘⇧B) and the path of the selected file (⌘⇧C), unless changed. */
export function useCopyShortcuts(pr: PullDetail | null, currentFile: string | null) {
  useShortcut('copy-branch', () => {
    if (pr) {
      copyText(pr.headRef)
    }
  })
  useShortcut('copy-file', () => {
    if (pr) {
      copyFilePath(currentFile)
    }
  })
}
