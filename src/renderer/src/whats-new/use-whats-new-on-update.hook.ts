import { useEffect } from 'react'
import type { Route } from '../common/route.types.ts'

/** Opens What's new the first time Revio runs after an update, once. */
export function useWhatsNewOnUpdate(go: (route: Route) => void) {
  useEffect(() => {
    let live = true
    globalThis.revio.getUnseenUpdate().then((update) => {
      if (!live) {
        return
      }
      if (update) {
        go({ view: 'whats-new', update })
      }
      // Also without an update: it is the release the next one is compared with.
      globalThis.revio.markUpdateSeen()
    })
    return () => {
      live = false
    }
  }, [go])
}
