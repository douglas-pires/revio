import { useEffect, useRef } from 'react'
import type { PullFile } from '@shared/pull.types'
import { isTyping } from '../common/keyboard.util'

interface NavState {
  enabled: boolean
  files: PullFile[]
  current: string | null
  viewed: Record<string, string>
  goTo: (path: string, expand: boolean) => void
  markViewed: (path: string, sha: string, viewed: boolean) => void
}

/** Next file index for j/k, clamped to the list; starts at the first file when nothing is current. */
function stepIndex(index: number, key: 'j' | 'k', length: number) {
  if (index < 0) return 0
  return Math.min(length - 1, Math.max(0, index + (key === 'j' ? 1 : -1)))
}

/** The first unviewed file after `index`, wrapping around. */
function nextUnviewed(files: PullFile[], index: number, viewed: Record<string, string>) {
  const rotated = [...files.slice(index + 1), ...files.slice(0, Math.max(0, index))]
  return rotated.find((f) => viewed[f.path] !== f.sha)
}

/**
 * j/k move between files, v toggles "viewed" and moves on to the next unviewed file.
 * Reads the latest state through a ref so the window listener is attached once.
 */
export function useFileKeyboardNav(state: NavState) {
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = latest.current
      if (!s.enabled || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return
      if (e.key !== 'j' && e.key !== 'k' && e.key !== 'v') return
      e.preventDefault()
      const index = s.current ? s.files.findIndex((f) => f.path === s.current) : -1
      if (e.key !== 'v') {
        const target = s.files[stepIndex(index, e.key, s.files.length)]
        if (target) s.goTo(target.path, false)
        return
      }
      const file = s.files[Math.max(0, index)]
      if (!file) return
      const nowViewed = s.viewed[file.path] !== file.sha
      s.markViewed(file.path, file.sha, nowViewed)
      if (!nowViewed) return s.goTo(file.path, true)
      const after = nextUnviewed(s.files, index, s.viewed)
      s.goTo((after ?? file).path, !!after)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
