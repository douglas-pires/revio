import { useEffect, useState } from 'react'
import type { BriefingRecord } from '@shared/claude.types'
import { pullKey, type PullRef } from '@shared/pull.types'
import { errorMessage } from '../common/format.util'

export interface BriefingStatus {
  loading: boolean
  progress: string | null
  error: string | null
}

const IDLE: BriefingStatus = { loading: false, progress: null, error: null }

/** Generates Claude's briefing for a PR, following its progress events. */
export function useBriefing(pull: PullRef, onRecord: (record: BriefingRecord) => void) {
  const [status, setStatus] = useState<BriefingStatus>(IDLE)
  const key = pullKey(pull)

  useEffect(
    () =>
      window.revio.onEvent((e) => {
        if (e.type === 'briefing-progress' && e.key === key) setStatus((s) => ({ ...s, progress: e.message }))
      }),
    [key],
  )

  const generate = async () => {
    setStatus({ loading: true, progress: null, error: null })
    try {
      onRecord(await window.revio.generateBriefing(pull))
      setStatus(IDLE)
    } catch (e) {
      setStatus({ ...IDLE, error: errorMessage(e) })
    }
  }

  return { status, generate }
}
