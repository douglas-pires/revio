import { useEffect, useState } from 'react'
import type { BlameRange, FileAtCommit } from '@shared/history.types'
import { errorMessage } from '../common/format.util'

/** Blame for a file at the PR head, fetched once it is wanted (blame on, file open and in view). */
export function useBlame(at: FileAtCommit, wanted: boolean) {
  const [ranges, setRanges] = useState<BlameRange[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { repo, sha, path } = at
  useEffect(() => {
    if (!wanted || ranges || error) return
    let live = true
    window.revio
      .getBlame({ repo, sha, path })
      .then((r) => live && setRanges(r))
      .catch((e) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [wanted, ranges, error, repo, sha, path])
  return { ranges, error }
}
