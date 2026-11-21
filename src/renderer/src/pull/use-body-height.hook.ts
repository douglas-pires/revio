import { useEffect, useRef, useState } from 'react'

const ROW_HEIGHT = 20
/** The height of a body with no rows: the binary-file or too-large note. */
const EMPTY_BODY_HEIGHT = 72

/** Placeholder height for a diff body that has not rendered yet. */
export function estimateBodyHeight(rowCount: number) {
  if (rowCount === 0) {
    return EMPTY_BODY_HEIGHT
  }
  return rowCount * ROW_HEIGHT
}

/** Tracks the rendered body's height so its placeholder keeps the same size after it unmounts. */
export function useBodyHeight(mounted: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [last, setLast] = useState<number | null>(null)
  useEffect(() => {
    const element = ref.current
    if (!(mounted && element)) {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry?.contentRect.height ?? 0)
      if (height) {
        // React skips the update when the height has not changed.
        setLast(height)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [mounted])
  return { ref, last }
}
