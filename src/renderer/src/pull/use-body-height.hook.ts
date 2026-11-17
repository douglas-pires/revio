import { useEffect, useRef, useState } from 'react'

const ROW_HEIGHT = 20

/** Placeholder height for a diff body that has not rendered yet. */
export function estimateBodyHeight(rowCount: number) {
  return rowCount ? rowCount * ROW_HEIGHT : 72
}

/** Tracks the rendered body's height so its placeholder keeps the same size after it unmounts. */
export function useBodyHeight(mounted: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [last, setLast] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!mounted || !el) return
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry?.contentRect.height ?? 0)
      if (height) setLast((prev) => (prev === height ? prev : height))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [mounted])
  return { ref, last }
}
