import type { AskMessage, AskThread } from '@shared/claude.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { useEffect, useState } from 'react'
import { errorMessage } from '../common/format.util.ts'

/**
 * Asking Claude about a selection: the question being typed, the answer streaming in (`pending`, null when idle)
 * and why the last question failed. `send` adds the question, then the answer, through `onChange`.
 */
export function useAskConversation(pull: PullRef, thread: AskThread, onChange: (thread: AskThread) => void) {
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      globalThis.revio.onEvent((e) => {
        if (e.type === 'ask-delta' && e.threadId === thread.id) {
          setPending((p) => (p ?? '') + e.text)
        }
      }),
    [thread.id],
  )

  const send = async (q: string) => {
    const text = q.trim()
    if (!text || pending !== null) {
      return
    }
    // Lines added to the chat go with this question, and are no longer pending.
    const { pendingContext, ...rest } = thread
    const sent: AskMessage = { role: 'user', content: text }
    if (pendingContext?.length) {
      sent.context = pendingContext
    }
    const asked: AskThread = { ...rest, messages: [...thread.messages, sent] }
    onChange(asked)
    setQuestion('')
    setPending('')
    setError(null)
    try {
      const { answer } = await globalThis.revio.askClaude(pull, asked)
      onChange({ ...asked, messages: [...asked.messages, { role: 'assistant', content: answer }] })
    } catch (e) {
      setError(errorMessage(e))
      // Drop the unanswered question so it can be retried or edited.
      onChange(thread)
      setQuestion(text)
    } finally {
      setPending(null)
    }
  }

  return { question, setQuestion, pending, error, setError, send }
}
