import { useEffect } from 'react'

export interface ScrollTarget {
  path: string
  line: number | null
}

const MAX_FRAMES = 60

/**
 * Scrolls to a file (and line) in the diff list. Files render lazily, so the line may only exist a few
 * frames after its file scrolls into view; this retries each frame for about a second.
 */
export function useScrollToTarget(target: ScrollTarget | null, active: boolean, onDone: () => void) {
  useEffect(() => {
    if (!target || !active) return
    let frame = 0
    let raf = 0
    const attempt = () => {
      const fileEl = document.getElementById(`file-${target.path}`)
      const lineEl = target.line ? fileEl?.querySelector(`tr[data-new-line="${target.line}"]`) : null
      if (fileEl && (lineEl || !target.line || frame >= MAX_FRAMES)) {
        ;(lineEl ?? fileEl).scrollIntoView({ block: lineEl ? 'center' : 'start' })
        if (lineEl) flash(lineEl)
        onDone()
        return
      }
      if (fileEl && frame === 0) fileEl.scrollIntoView({ block: 'start' })
      frame++
      if (frame <= MAX_FRAMES) raf = requestAnimationFrame(attempt)
      else onDone()
    }
    attempt()
    return () => cancelAnimationFrame(raf)
  }, [target, active, onDone])
}

function flash(el: Element) {
  el.classList.add('flash')
  setTimeout(() => el.classList.remove('flash'), 1200)
}
