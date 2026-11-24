import type { BriefingRecord } from '@shared/claude.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { BriefingRuns } from './briefing-runs.service.ts'

const runs = new BriefingRuns({
  generate: (pull) => globalThis.revio.generateBriefing(pull),
  watchProgress: (key, onProgress) =>
    globalThis.revio.onEvent((event) => {
      if (event.type === 'briefing-progress' && event.key === key) {
        onProgress(event.message)
      }
    }),
})

/** Claude's briefing for a PR: how it stands, even if it was started before you left the PR, and starting one. */
export function useBriefing(pull: PullRef, onRecord: (record: BriefingRecord) => void) {
  const key = buildPullKey(pull)
  const status = useSyncExternalStore(
    useCallback((listener) => runs.watchStatus(key, listener), [key]),
    () => runs.status(key),
  )
  const latestOnRecord = useRef(onRecord)
  latestOnRecord.current = onRecord
  useEffect(() => runs.watchRecord(key, (record) => latestOnRecord.current(record)), [key])
  return { status, generate: () => runs.start(pull) }
}
