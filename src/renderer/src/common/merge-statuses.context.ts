import type { MergeStatus } from '@shared/merge-status.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { createContext, useEffect, useMemo, useState } from 'react'

/** What stands between each listed PR and merging, by "repo#number" (empty until loaded), and your login. */
export const MergeStatusesContext = createContext<{
  statuses: Readonly<Record<string, MergeStatus>>
  viewer?: string | undefined
}>({ statuses: {} })

/** The PRs back from their joined keys, "acme/web#12,acme/api#3". */
function readRefs(keys: string): PullRef[] {
  if (!keys) {
    return []
  }
  return keys.split(',').map((key) => {
    const at = key.lastIndexOf('#')
    return { repo: key.slice(0, at), number: Number(key.slice(at + 1)) }
  })
}

/**
 * The merge statuses of the PRs a screen lists, asked for once the list is there (and again when it changes); the
 * chips fill in when GitHub answers.
 */
export function useMergeStatuses(pulls: readonly PullRef[]) {
  const [statuses, setStatuses] = useState<Record<string, MergeStatus>>({})
  // The list as a string, so a new array with the same PRs asks nothing new.
  const keys = pulls.map(buildPullKey).join(',')
  const refs = useMemo(() => readRefs(keys), [keys])
  useEffect(() => {
    if (refs.length === 0) {
      return
    }
    let live = true
    globalThis.revio
      .getMergeStatuses(refs)
      .then((loaded) => live && setStatuses(loaded))
      // Without them the rows simply show no chips.
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [refs])
  return statuses
}
