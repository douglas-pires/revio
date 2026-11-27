import type { SimilarComment } from '@shared/review-history.types.ts'
import { useEffect, useState } from 'react'

/** How long typing must pause before the comment is compared with your past ones. */
const PAUSE_MS = 700

/** Your past comments that read like `body`, looked up once typing pauses; none while `enabled` is false. */
export function useSimilarComments(body: string, enabled: boolean): SimilarComment[] {
  const [found, setFound] = useState<SimilarComment[]>([])
  useEffect(() => {
    if (!(enabled && body.trim())) {
      setFound([])
      return
    }
    let current = true
    const timer = setTimeout(() => {
      globalThis.revio
        .findSimilarComments(body)
        .then((comments) => current && setFound(comments))
        // Without your past reviews there is just no hint.
        .catch(() => current && setFound([]))
    }, PAUSE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [body, enabled])
  return found
}
