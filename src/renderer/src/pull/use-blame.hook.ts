import type { BlameRange, FileAtCommit } from '@shared/history.types.ts'
import { useEffect, useState } from 'react'
import { errorMessage } from '../common/format.util.ts'

/** Blame for a file at the PR head, fetched once it is wanted (blame on, file open and in view). */
export function useBlame(at: FileAtCommit, wanted: boolean) {
  const [ranges, setRanges] = useState<BlameRange[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { repo, sha, path } = at
  useEffect(() => {
    if (!wanted || ranges || error) {
      return
    }
    let live = true
    globalThis.revio
      .getBlame({ repo, sha, path })
      .then((loadedRanges) => live && setRanges(loadedRanges))
      .catch((failure) => live && setError(errorMessage(failure)))
    return () => {
      live = false
    }
  }, [wanted, ranges, error, repo, sha, path])
  return { ranges, error }
}
