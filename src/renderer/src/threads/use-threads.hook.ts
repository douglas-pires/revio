import type { ThreadsInbox } from '@shared/thread.types.ts'
import { MS_PER_MINUTE } from '@shared/time.util.ts'
import { useCallback, useEffect, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { applyReply, setMembership } from './thread-edits.util.ts'

/** A copy this recent is reused when the inbox opens; Refresh always fetches. */
const THREADS_MAX_AGE_MS = 2 * MS_PER_MINUTE

/** Unresolved review threads you are part of, loaded when the inbox opens, with reply and resolve. */
export function useThreads() {
  const [data, setData] = useState<ThreadsInbox | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Resolved in this session; kept on screen with Undo until the next fetch. */
  const [resolved, setResolved] = useState<ReadonlySet<string>>(new Set())

  const reload = useCallback(async (maxAgeMs = 0) => {
    setError(null)
    try {
      setData(await globalThis.revio.getThreads(maxAgeMs))
      setResolved(new Set())
    } catch (failure) {
      setError(readErrorMessage(failure))
    }
  }, [])

  useEffect(() => {
    reload(THREADS_MAX_AGE_MS)
  }, [reload])

  const reply = useCallback(async (threadId: string, body: string) => {
    const comment = await globalThis.revio.replyToThread(threadId, body)
    setData((current) => current && { ...current, threads: applyReply(current.threads, threadId, comment) })
  }, [])

  const setThreadResolved = useCallback(async (threadId: string, value: boolean) => {
    await globalThis.revio.setThreadResolved(threadId, value)
    setResolved((current) => setMembership(current, threadId, value))
  }, [])

  return { threads: data?.threads ?? null, resolved, error, reload, reply, setThreadResolved }
}
