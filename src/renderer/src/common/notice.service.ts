/** How long a notice stays. */
const NOTICE_MS = 2000

let shown: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function setShown(text: string | null) {
  shown = text
  for (const listener of listeners) {
    listener()
  }
}

/** Says something briefly at the bottom of the window, such as what a shortcut did. */
export function showNotice(text: string) {
  clearTimeout(timer)
  timer = setTimeout(() => setShown(null), NOTICE_MS)
  setShown(text)
}

export const readNotice = () => shown

export function watchNotice(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
