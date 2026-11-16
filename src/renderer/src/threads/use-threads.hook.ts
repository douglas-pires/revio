import { useCallback, useEffect, useState } from 'react'
import type { ThreadsInbox } from '@shared/thread.types'
import { errorMessage } from '../common/format.util'
import { applyReply, setMembership } from './thread-edits.util'

/** A copy this recent is reused when the inbox opens; Refresh always fetches. */
const THREADS_MAX_AGE_MS = 2 * 60_000

/** Unresolved review threads you are part of, loaded when the inbox opens, with reply and resolve. */
export function useThreads() {
  const [data, setData] = useState<ThreadsInbox | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Resolved in this session; kept on screen with Undo until the next fetch. */
  const [resolved, setResolved] = useState<ReadonlySet<string>>(new Set())

  const reload = useCallback(async (maxAgeMs = 0) => {
    setError(null)
    try {
      setData(await window.revio.getThreads(maxAgeMs))
      setResolved(new Set())
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  useEffect(() => {
    void reload(THREADS_MAX_AGE_MS)
  }, [reload])

  const reply = useCallback(async (threadId: string, body: string) => {
    const comment = await window.revio.replyToThread(threadId, body)
    setData((d) => d && { ...d, threads: applyReply(d.threads, threadId, comment) })
  }, [])

  const setThreadResolved = useCallback(async (threadId: string, value: boolean) => {
    await window.revio.setThreadResolved(threadId, value)
    setResolved((current) => setMembership(current, threadId, value))
  }, [])

  return { threads: data?.threads ?? null, resolved, error, reload, reply, setThreadResolved }
}
