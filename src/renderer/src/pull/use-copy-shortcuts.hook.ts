import type { PullDetail } from '@shared/pull.types.ts'
import { copyText } from '../common/copy-text.service.ts'
import { showNotice } from '../common/notice.service.ts'
import { buildPermalink } from '../common/permalink.util.ts'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'
import { findFileInView, findFilePathAt } from './file-in-view.util.ts'

/** Copies the path of the file you are reading; says so when there is none. */
function copyFilePath(currentFile: string | null) {
  const path = findFileInView(currentFile)
  if (path) {
    copyText(path)
  } else {
    showNotice('No file selected')
  }
}

/** The new-side line number of the diff row a DOM node is in, or null outside one (or on a removed line). */
function readNewLine(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement
  const line = element?.closest('tr[data-new-line]')?.getAttribute('data-new-line')
  if (!line) {
    return null
  }
  return Number(line)
}

/** The file and lines the diff selection covers in the PR's latest version; null with no selection in a diff. */
function readSelectedLines(selection: Selection | null) {
  if (!(selection && selection.rangeCount > 0)) {
    return null
  }
  const anchorElement =
    selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement
  const path = findFilePathAt(anchorElement ?? null)
  const first = readNewLine(selection.anchorNode)
  const last = readNewLine(selection.focusNode) ?? first
  if (path === null || first === null || last === null) {
    return null
  }
  return { path, start: Math.min(first, last), end: Math.max(first, last) }
}

/** Copies a permalink to the selected lines, or to the file you are reading when no lines are selected. */
function copyPermalink(pr: PullDetail, currentFile: string | null) {
  const selected = readSelectedLines(globalThis.getSelection())
  const path = selected?.path ?? findFileInView(currentFile)
  if (!path) {
    showNotice('No file selected')
    return
  }
  copyText(buildPermalink(pr.url, pr.headSha, path, selected))
}

/** Shortcuts copy the PR's branch name (⌘⇧B) and the path of the selected file (⌘⇧C), and a permalink to the selected lines (⌘⇧L), unless changed. */
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
  useShortcut('copy-permalink', () => {
    if (pr) {
      copyPermalink(pr, currentFile)
    }
  })
}
