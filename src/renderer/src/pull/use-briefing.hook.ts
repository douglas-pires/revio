import type { BriefingRecord } from '@shared/claude.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { useEffect, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'

const IDLE: BriefingStatus = { loading: false, progress: null, error: null }

export interface BriefingStatus {
  loading: boolean
  progress: string | null
  error: string | null
}

/** Generates Claude's briefing for a PR, following its progress events. */
export function useBriefing(pull: PullRef, onRecord: (record: BriefingRecord) => void) {
  const [status, setStatus] = useState<BriefingStatus>(IDLE)
  const key = buildPullKey(pull)

  useEffect(
    () =>
      globalThis.revio.onEvent((event) => {
        if (event.type === 'briefing-progress' && event.key === key) {
          setStatus((current) => ({ ...current, progress: event.message }))
        }
      }),
    [key],
  )

  const generate = async () => {
    setStatus({ loading: true, progress: null, error: null })
    try {
      onRecord(await globalThis.revio.generateBriefing(pull))
      setStatus(IDLE)
    } catch (failure) {
      setStatus({ ...IDLE, error: readErrorMessage(failure) })
    }
  }

  return { status, generate }
}
