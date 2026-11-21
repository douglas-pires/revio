import type { CommitCheck } from '@shared/git-log.types.ts'
import { useEffect, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'

/** What a load in progress, done, or failed has to show. */
interface Loaded<T> {
  value: T | null
  error: string | null
}

/** Loads `load()` whenever its inputs change; null inputs (nothing picked) load nothing. Drops a stale answer. */
function useLoaded<T>(load: (() => Promise<T>) | null, inputs: readonly unknown[]): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ value: null, error: null })
  useEffect(() => {
    setLoaded({ value: null, error: null })
    if (!load) {
      return
    }
    let stillWanted = true
    load()
      .then((value) => stillWanted && setLoaded({ value, error: null }))
      .catch((failure) => stillWanted && setLoaded({ value: null, error: readErrorMessage(failure) }))
    return () => {
      stillWanted = false
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: `load` is rebuilt each render; `inputs` are what it reads.
  }, inputs)
  return loaded
}

/** Loads the file's patch from GitHub ('' when it has none: binary or too large), or nothing while none is picked. */
function buildPatchLoader(repo: string, hash: string | null, path: string | null) {
  if (!(hash && path)) {
    return null
  }
  return async () => (await globalThis.revio.getCommitFilePatch({ repo, sha: hash, path })) ?? ''
}

/** Loads the commit's checks, or nothing while no commit is picked. */
function buildChecksLoader(repo: string, hash: string | null) {
  if (!hash) {
    return null
  }
  return () => globalThis.revio.getCommitChecks(repo, hash)
}

/** One file's patch in the picked commit, while a file is open. */
export function useFilePatch(repo: string, hash: string | null, path: string | null): Loaded<string> {
  return useLoaded(buildPatchLoader(repo, hash, path), [repo, hash, path])
}

/** The picked commit's checks on GitHub. */
export function useCommitChecks(repo: string, hash: string | null): Loaded<CommitCheck[]> {
  return useLoaded(buildChecksLoader(repo, hash), [repo, hash])
}
