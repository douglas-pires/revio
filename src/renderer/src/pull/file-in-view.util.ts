/** How far below the top of the diff the reading line sits, in px: below a stuck file header. */
const READING_LINE_PX = 48
const FILE_ID_PREFIX = 'file-'

function doesOverlap(first: { top: number; bottom: number }, second: { top: number; bottom: number }) {
  return first.bottom > second.top && first.top < second.bottom
}

export interface Span {
  top: number
  bottom: number
}

export interface FileSpan extends Span {
  path: string
}

/**
 * The file you are reading: the current one (last clicked or jumped to) while any of it is on screen, else the file
 * across the reading line near the top of the diff, else the first file below it. Null when no file is on screen.
 */
export function pickFileInView(current: string | null, files: readonly FileSpan[], view: Span): string | null {
  const onScreen = files.filter((file) => doesOverlap(file, view))
  if (onScreen.some((file) => file.path === current)) {
    return current
  }
  const line = view.top + READING_LINE_PX
  const across = onScreen.find((file) => file.top <= line && file.bottom > line)
  return (across ?? onScreen[0])?.path ?? null
}

/** The changed file a DOM node is in, from its card's `file-<path>` id. */
export function findFilePathAt(node: Element | null): string | null {
  const card = node?.closest(`[id^="${FILE_ID_PREFIX}"]`)
  if (!card) {
    return null
  }
  return card.id.slice(FILE_ID_PREFIX.length)
}

/** `pickFileInView` on the files tab as laid out now; `current` when the tab is not showing. */
export function findFileInView(current: string | null): string | null {
  const scroller = document
    .querySelector('[data-scroll-root]:not(.hidden) [data-find-scope]')
    ?.closest('[data-scroll-root]')
  if (!scroller) {
    return current
  }
  const { top, bottom } = scroller.getBoundingClientRect()
  const cards = [...scroller.querySelectorAll(`[id^="${FILE_ID_PREFIX}"]`)].map((el) => {
    const bounds = el.getBoundingClientRect()
    return { path: el.id.slice(FILE_ID_PREFIX.length), top: bounds.top, bottom: bounds.bottom }
  })
  return pickFileInView(current, cards, { top, bottom }) ?? current
}
