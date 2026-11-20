import type { PullFile } from '@shared/pull.types.ts'
import { useEffect, useRef } from 'react'
import { isTyping } from '../common/keyboard.util.ts'
import { fileInView } from './file-in-view.util.ts'

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
function indexOfPath(s: NavState, path: string | null) {
  if (!path) {
    return -1
  }
  return s.files.findIndex((f) => f.path === path)
}

/** v: marks the file you are reading viewed (see `fileInView`) and moves on to the next unviewed one; unmarking keeps it open. */
function toggleViewedAndMove(s: NavState, index: number) {
  const file = s.files[Math.max(0, index)]
  if (!file) {
    return
  }
  const nowViewed = s.viewed[file.path] !== file.sha
  s.markViewed(file.path, file.sha, nowViewed)
  if (!nowViewed) {
    s.goTo(file.path, true)
    return
  }
  const after = nextUnviewed(s.files, index, s.viewed)
  s.goTo((after ?? file).path, Boolean(after))
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
  return rotated.find((f) => viewed[f.path] !== f.sha)
}

/**
 * j/k move between files; v toggles "viewed" on the file you are reading (the one you clicked or jumped to while it is
 * on screen, else the one at the top of the diff) and moves on to the next unviewed file.
 * Reads the latest state through a ref so the window listener is attached once.
 */
export function useFileKeyboardNav(state: NavState) {
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = latest.current
      if (!s.enabled || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) {
        return
      }
      if (e.key !== 'j' && e.key !== 'k' && e.key !== 'v') {
        return
      }
      e.preventDefault()
      if (e.key === 'v') {
        toggleViewedAndMove(s, indexOfPath(s, fileInView(s.current)))
        return
      }
      const index = indexOfPath(s, s.current)
      const target = s.files[stepIndex(index, e.key, s.files.length)]
      if (target) {
        s.goTo(target.path, false)
      }
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])
}
