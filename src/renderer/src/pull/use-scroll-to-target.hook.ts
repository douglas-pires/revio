import { useEffect } from 'react'

export interface ScrollTarget {
  path: string
  line: number | null
  /** A review comment in that file to land on, e.g. the one that mentioned you. */
  commentId?: number
  /** Open the reply box of that comment's thread. */
  reply?: boolean
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
      const exact = findExact(fileEl, target)
      if (fileEl && (exact || (!target.line && !target.commentId) || frame >= MAX_FRAMES)) {
        // A comment can be taller than the window, so it lands at the top (below the sticky file header); a line is centered.
        ;(exact ?? fileEl).scrollIntoView({ block: exact?.matches('tr') ? 'center' : 'start' })
        if (exact) flash(exact)
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

/** The comment when one is asked for and rendered (opening the folded outdated list if it is in there), else the line's row. */
function findExact(fileEl: HTMLElement | null, target: ScrollTarget): Element | null {
  const comment = target.commentId ? fileEl?.querySelector(`[data-comment-id="${target.commentId}"]`) : null
  if (comment) {
    const folded = comment.closest('details')
    if (folded) folded.open = true
    return comment
  }
  return target.line ? (fileEl?.querySelector(`tr[data-new-line="${target.line}"]`) ?? null) : null
}

function flash(el: Element) {
  el.classList.add('flash')
  setTimeout(() => el.classList.remove('flash'), 1200)
}
