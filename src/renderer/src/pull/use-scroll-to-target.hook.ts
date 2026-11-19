import type { DiffSide } from '@shared/pull.types.ts'
import { useEffect } from 'react'

const MAX_FRAMES = 60
const FLASH_MS = 1200
/** The row attribute holding a line number, by side. */
const LINE_ATTRIBUTES: Record<DiffSide, string> = { LEFT: 'data-old-line', RIGHT: 'data-new-line' }

/** The rendered file's element, found by path (paths hold characters CSS selectors treat specially). */
const fileElementOf = (path: string) => document.querySelector<HTMLElement>(`#${CSS.escape(`file-${path}`)}`)

/** The comment when one is asked for and rendered (opening the folded outdated list if it is in there), else the line's row. */
function findExact(fileEl: HTMLElement | null, target: ScrollTarget): Element | null {
  let comment: Element | null | undefined = null
  if (target.commentId) {
    comment = fileEl?.querySelector(`[data-comment-id="${target.commentId}"]`)
  }
  if (comment) {
    const folded = comment.closest('details')
    if (folded) {
      folded.open = true
    }
    return comment
  }
  if (!target.line) {
    return null
  }
  return fileEl?.querySelector(`tr[${LINE_ATTRIBUTES[target.side ?? 'RIGHT']}="${target.line}"]`) ?? null
}

function flash(el: Element) {
  el.classList.add('flash')
  setTimeout(() => el.classList.remove('flash'), FLASH_MS)
}

/**
 * Scrolls to where the jump lands, flashing it when it is the exact comment or line. A comment can be taller than the
 * window, so it lands at the top (below the sticky file header); a line is centered.
 */
function land(el: Element, exact: boolean) {
  let block: ScrollLogicalPosition = 'start'
  if (el.matches('tr')) {
    block = 'center'
  }
  el.scrollIntoView({ block })
  if (exact) {
    flash(el)
  }
}

export interface ScrollTarget {
  path: string
  line: number | null
  /** Which side `line` counts on; RIGHT (the new file) unless it is a removed line. */
  side?: DiffSide
  /** A review comment in that file to land on, e.g. the one that mentioned you. */
  commentId?: number | undefined
  /** Open the reply box of that comment's thread. */
  reply?: boolean
}

/**
 * Scrolls to a file (and line) in the diff list. Files render lazily, so the line may only exist a few
 * frames after its file scrolls into view; this retries each frame for about a second.
 */
export function useScrollToTarget(target: ScrollTarget | null, active: boolean, onDone: () => void) {
  useEffect(() => {
    if (!(target && active)) {
      return
    }
    let frame = 0
    let raf = 0
    const attempt = () => {
      const fileEl = fileElementOf(target.path)
      const exact = findExact(fileEl, target)
      if (fileEl && (exact || !(target.line || target.commentId) || frame >= MAX_FRAMES)) {
        land(exact ?? fileEl, exact !== null)
        onDone()
        return
      }
      if (fileEl && frame === 0) {
        fileEl.scrollIntoView({ block: 'start' })
      }
      frame += 1
      if (frame <= MAX_FRAMES) {
        raf = requestAnimationFrame(attempt)
      } else {
        onDone()
      }
    }
    attempt()
    return () => cancelAnimationFrame(raf)
  }, [target, active, onDone])
}
