import type { PullFile } from '@shared/pull.types.ts'
import { useEffect, useRef } from 'react'
import { isTyping } from '../common/keyboard.util.ts'
import { fileInView } from './file-in-view.util.ts'
import { useOpenInEditorShortcut } from './use-open-in-editor-shortcut.hook.ts'

interface NavState {
  enabled: boolean
  files: PullFile[]
  current: string | null
  viewed: Record<string, string>
  goTo: (path: string, expand: boolean) => void
  markViewed: (path: string, sha: string, viewed: boolean) => void
}

/** j goes down the list, k up. */
const STEPS = { j: 1, k: -1 } as const

/** Where a file sits in the list, -1 for none. */
function indexOfPath(state: NavState, path: string | null) {
  if (!path) {
    return -1
  }
  return state.files.findIndex((file) => file.path === path)
}

/** v: marks the file you are reading viewed (see `fileInView`) and moves on to the next unviewed one; unmarking keeps it open. */
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
  const after = nextUnviewed(state.files, index, state.viewed)
  state.goTo((after ?? file).path, Boolean(after))
}

/** Next file index for j/k, clamped to the list; starts at the first file when nothing is current. */
function stepIndex(index: number, key: 'j' | 'k', length: number) {
  if (index < 0) {
    return 0
  }
  return Math.min(length - 1, Math.max(0, index + STEPS[key]))
}

/** The first unviewed file after `index`, wrapping around. */
function nextUnviewed(files: PullFile[], index: number, viewed: Record<string, string>) {
  const rotated = [...files.slice(index + 1), ...files.slice(0, Math.max(0, index))]
  return rotated.find((file) => viewed[file.path] !== file.sha)
}

/**
 * j/k move between files; v toggles "viewed" on the file you are reading (the one you clicked or jumped to while it is
 * on screen, else the one at the top of the diff) and moves on to the next unviewed file.
 * The Open in editor shortcut works alongside them (`useOpenInEditorShortcut`).
 * Reads the latest state through a ref so the window listener is attached once.
 */
export function useFileKeyboardNav(state: NavState) {
  useOpenInEditorShortcut({ enabled: state.enabled, currentFile: state.current })
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const navState = latest.current
      if (
        !navState.enabled ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.repeat ||
        isTyping(event.target)
      ) {
        return
      }
      if (event.key !== 'j' && event.key !== 'k' && event.key !== 'v') {
        return
      }
      event.preventDefault()
      if (event.key === 'v') {
        toggleViewedAndMove(navState, indexOfPath(navState, fileInView(navState.current)))
        return
      }
      const index = indexOfPath(navState, navState.current)
      const target = navState.files[stepIndex(index, event.key, navState.files.length)]
      if (target) {
        navState.goTo(target.path, false)
      }
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])
}
