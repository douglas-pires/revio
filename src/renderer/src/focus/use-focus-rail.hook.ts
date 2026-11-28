import type { FocusRail } from '@shared/settings.types.ts'
import { useEffect, useState } from 'react'

/** What the left rail shows during a review block; read at start and again on leaving Settings, where it is chosen. */
export function useFocusRail(screen: string) {
  const [rail, setRail] = useState<FocusRail>('quiet')
  const inSettings = screen === 'settings'
  useEffect(() => {
    if (!inSettings) {
      globalThis.revio.getSettings().then((settings) => setRail(settings.focusRail))
    }
  }, [inSettings])
  return rail
}
