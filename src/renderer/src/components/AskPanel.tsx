import { useEffect, useRef, useState } from 'react'
import type { AskThread } from '@shared/types'
import { ago, cx, errorMessage } from '../lib/format'
import { Markdown } from './Markdown'

const QUICK = [
  'What does this change do, and why?',
  'Is this safe? Which edge cases or inputs could break it?',
  'How does this interact with the rest of the PR?',
  'Draft a review comment for this.',
]

export function AskPanel(props: {
  repo: string
  number: number
  thread: AskThread
  history: AskThread[]
  onSelect: (id: string) => void
  onChange: (thread: AskThread) => void
  onClose: () => void
  onJump: (path: string, line: number) => void
  onUseAsDraft: (thread: AskThread, body: string) => void
}) {
  const { thread } = props
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    input.current?.focus()
    setError(null)
  }, [thread.id])

  useEffect(
    () =>
      window.revio.onEvent((e) => {
        if (e.type === 'ask-delta' && e.threadId === thread.id) setPending((p) => (p ?? '') + e.text)
      }),
    [thread.id],
  )

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [thread.messages.length, pending])

  const send = async (q: string) => {
    const text = q.trim()
    if (!text || pending !== null) return
    const asked: AskThread = { ...thread, messages: [...thread.messages, { role: 'user', content: text }] }
    props.onChange(asked)
    setQuestion('')
    setPending('')
    setError(null)
    try {
      const { answer } = await window.revio.askClaude(props.repo, props.number, asked)
      props.onChange({ ...asked, messages: [...asked.messages, { role: 'assistant', content: answer }] })
    } catch (e) {
      setError(errorMessage(e))
      // Drop the unanswered question so it can be retried or edited.
      props.onChange(thread)
      setQuestion(text)
    } finally {
      setPending(null)
    }
  }

  const lines = thread.startLine === thread.endLine ? `${thread.startLine}` : `${thread.startLine}–${thread.endLine}`

  return (
    <aside className="flex w-[440px] shrink-0 flex-col border-l border-line bg-panel">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-accent">✦</span>
        <span className="font-semibold">Ask Claude</span>
        <div className="flex-1" />
        {props.history.length > 1 && (
          <select className="input w-40 py-0.5 text-[12px]" value={thread.id} onChange={(e) => props.onSelect(e.target.value)}>
            {props.history.map((t) => (
              <option key={t.id} value={t.id}>
                {t.path.split('/').pop()}:{t.startLine} · {t.messages.length ? ago(t.createdAt) : 'new'}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-ghost px-1.5" onClick={props.onClose} title="Close">
          ✕
        </button>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3 py-3">
        <button
          className="block w-full text-left font-mono text-[11.5px] text-accent hover:underline"
          onClick={() => props.onJump(thread.path, thread.endLine)}
        >
          {thread.path}:{lines} {thread.side === 'LEFT' && <span className="text-muted">(old side)</span>}
        </button>
        <pre className="selectable max-h-56 overflow-auto rounded-md border border-line bg-bg p-2 font-mono text-[11.5px] leading-[18px]">
          {thread.snippet.split('\n').map((l, i) => (
            <div key={i} className={cx(l.startsWith('+') && 'bg-add-bg', l.startsWith('-') && 'bg-del-bg')}>
              {l || ' '}
            </div>
          ))}
        </pre>

        {thread.messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="selectable ml-8 rounded-lg bg-accent/15 px-3 py-2 whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={i} className="group">
              <Markdown className="text-[13px]">{m.content}</Markdown>
              <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button className="btn py-0" onClick={() => props.onUseAsDraft(thread, m.content)}>
                  + Use as draft comment
                </button>
                <button className="btn btn-ghost py-0" onClick={() => void navigator.clipboard.writeText(m.content)}>
                  Copy
                </button>
              </div>
            </div>
          ),
        )}

        {pending !== null &&
          (pending ? (
            <Markdown className="text-[13px]">{pending}</Markdown>
          ) : (
            <div className="flex items-center gap-2 text-muted">
              <span className="size-2 animate-pulse rounded-full bg-accent" /> Reading the file and the PR…
            </div>
          ))}
        {error && <p className="selectable text-danger">{error}</p>}

        {thread.messages.length === 0 && pending === null && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q} className="btn text-left" onClick={() => void send(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <textarea
          ref={input}
          className="input min-h-16 resize-none"
          placeholder={thread.messages.length ? 'Follow up…' : 'Ask about the selected code… (↵ to send, ⇧↵ for newline)'}
          value={question}
          disabled={pending !== null}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(question)
            }
            if (e.key === 'Escape') props.onClose()
          }}
        />
      </div>
    </aside>
  )
}
