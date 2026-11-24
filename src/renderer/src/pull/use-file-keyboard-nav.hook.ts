import type { PullFile } from '@shared/pull.types.ts'
import { showNotice } from '../common/notice.service.ts'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'
import { findFileInView } from './file-in-view.util.ts'
import { pickFileToUnview } from './last-viewed.util.ts'
import { useOpenInEditorShortcut } from './use-open-in-editor-shortcut.hook.ts'

interface NavState {
  enabled: boolean
  files: PullFile[]
  current: string | null
  viewed: Record<string, string>
  goTo: (path: string, expand: boolean) => void
  markViewed: (path: string, sha: string, viewed: boolean) => void
}

/** Where a file sits in the list, -1 for none. */
function indexOfPath(state: NavState, path: string | null) {
  if (!path) {
    return -1
  }
  return state.files.findIndex((file) => file.path === path)
}

/** Marks the file you are reading viewed (see `fileInView`) and moves on to the next unviewed one; unmarking keeps it open. */
function toggleViewedAndMove(state: NavState, index: number) {
  const file = state.files[Math.max(0, index)]
  if (!file) {
    return
  }
  const nowViewed = state.viewed[file.path] !== file.sha
  state.markViewed(file.path, file.sha, nowViewed)
  if (!nowViewed) {
    state.goTo(file.path, true)
    return
  }
  const after = findNextUnviewed(state.files, index, state.viewed)
  state.goTo((after ?? file).path, Boolean(after))
}

/** Unviews the file you are reading, or the last one you marked, and selects it. */
function unviewAndSelect(state: NavState) {
  const file = pickFileToUnview(state.files, state.viewed, findFileInView(state.current))
  if (!file) {
    showNotice('No viewed file')
    return
  }
  state.markViewed(file.path, file.sha, false)
  state.goTo(file.path, true)
}

/** The file a step away, clamped to the list; starts at the first file when nothing is current. */
function stepIndex(index: number, step: 1 | -1, length: number) {
  if (index < 0) {
    return 0
  }
  return Math.min(length - 1, Math.max(0, index + step))
}

/** The first unviewed file after `index`, wrapping around. */
function findNextUnviewed(files: PullFile[], index: number, viewed: Record<string, string>) {
  const rotated = [...files.slice(index + 1), ...files.slice(0, Math.max(0, index))]
  return rotated.find((file) => viewed[file.path] !== file.sha)
}

/**
 * Shortcuts (J and K unless changed) move between files; another (V) toggles "viewed" on the file you are reading (the
 * one you clicked or jumped to while it is on screen, else the one at the top of the diff) and moves on to the next
 * unviewed file, and one more (⌘⇧V) takes that back. The Open in editor shortcut works alongside them (`useOpenInEditorShortcut`).
 */
export function useFileKeyboardNav(state: NavState) {
  useOpenInEditorShortcut({ enabled: state.enabled, currentFile: state.current })
  const moveBy = (step: 1 | -1) => {
    const target = state.files[stepIndex(indexOfPath(state, state.current), step, state.files.length)]
    if (target) {
      state.goTo(target.path, false)
    }
  }
  const whenEnabled = (run: () => void) => {
    if (!state.enabled) {
      return null
    }
    return run
  }
  useShortcut(
    'next-file',
    whenEnabled(() => moveBy(1)),
  )
  useShortcut(
    'previous-file',
    whenEnabled(() => moveBy(-1)),
  )
  useShortcut(
    'unview',
    whenEnabled(() => unviewAndSelect(state)),
  )
  useShortcut(
    'toggle-viewed',
    whenEnabled(() => toggleViewedAndMove(state, indexOfPath(state, findFileInView(state.current)))),
  )
}
