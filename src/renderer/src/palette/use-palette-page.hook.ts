import { useEffect, useRef } from 'react'
import type { PalettePage } from './palette.types.ts'
import { addPalettePage } from './palette-pages.service.ts'

/** Offers a screen's actions in the palette while the screen shows. */
export function usePalettePage(page: PalettePage) {
  const latest = useRef(page)
  latest.current = page
  useEffect(() => addPalettePage(() => latest.current), [])
}
