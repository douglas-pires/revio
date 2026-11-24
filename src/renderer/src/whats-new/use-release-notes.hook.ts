import type { ReleaseNotes } from '@shared/whats-new.types.ts'
import { useCallback, useEffect, useState } from 'react'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { dropLaterReleases } from './release-range.util.ts'

/** The notes of the running release and those before it, and loading them again after a failure. */
export function useReleaseNotes() {
  const [releases, setReleases] = useState<readonly ReleaseNotes[] | null>(null)
  const { error, run } = useAsyncAction()
  const load = useCallback(
    () =>
      run(async () => {
        const [notes, status] = await Promise.all([
          globalThis.revio.listReleaseNotes(),
          globalThis.revio.getUpdateStatus(),
        ])
        setReleases(dropLaterReleases(notes, status.current))
      }),
    [run],
  )
  useEffect(() => {
    load()
  }, [load])
  return { releases, error, load }
}
