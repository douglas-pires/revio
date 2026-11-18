import { useEffect, useMemo, useRef, useState } from 'react'
import type { AskThread } from '@shared/claude.types'
import type { PullRef } from '@shared/pull.types'
import { errorMessage } from '../common/format.util'
import { Markdown } from '../common/markdown.component'
import { CopyButton } from '../common/copy-button.component'
import { snippetRows } from './diff.util'
import { StaticDiff } from './static-diff.component'
import { AskHistory } from './ask-history.component'

const QUICK = [
  'What does this change do, and why?',
  'Is this safe? Which edge cases or inputs could break it?',
  'How does this interact with the rest of the PR?',
  'Draft a review comment for this.',
]

export function AskPanel(props: {
  pull: PullRef
  thread: AskThread
  history: AskThread[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onChange: (thread: AskThread) => void
  onClose: () => void
  onJump: (path: string, line: number) => void
  onUseAsDraft: (thread: AskThread, body: string) => void
}) {
  const { thread } = props
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Showing the list of chats instead of the current one. */
  const [listing, setListing] = useState(false)
  const rows = useMemo(() => snippetRows(thread.snippet, thread.side, thread.startLine), [thread.snippet, thread.side, thread.startLine])
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    input.current?.focus()
    setError(null)
    setListing(false)
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
      const { answer } = await window.revio.askClaude(props.pull, asked)
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
          <button className={listing ? 'btn btn-primary py-0.5' : 'btn py-0.5'} onClick={() => setListing(!listing)} aria-pressed={listing}>
            Chats {props.history.length}
          </button>
        )}
        <button className="btn btn-ghost px-1.5" onClick={props.onClose} title="Close">
          ✕
        </button>
      </header>

      {listing ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <AskHistory
            threads={props.history}
            currentId={thread.id}
            onOpen={(id) => (id === thread.id ? setListing(false) : props.onSelect(id))}
            onDelete={props.onDelete}
          />
        </div>
      ) : (
        <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3 py-3">
        <button
          className="block w-full truncate text-left font-mono text-[11.5px] text-accent hover:underline"
          title={`${thread.path}:${lines}`}
          onClick={() => props.onJump(thread.path, thread.endLine)}
        >
          {thread.path}:{lines} {thread.side === 'LEFT' && <span className="text-muted">(old side)</span>}
        </button>
        <div className="group/snippet selectable relative max-h-56 overflow-auto rounded-md border border-line bg-bg">
          <StaticDiff path={thread.path} rows={rows} sourceLength={thread.snippet.length} />
          <CopyButton
            text={rows.map((r) => r.text).join('\n')}
            title="Copy code"
            className="btn btn-ghost absolute top-1 right-1 bg-bg py-0 text-[11px] opacity-0 transition group-hover/snippet:opacity-100 focus:opacity-100"
          >
            Copy
          </CopyButton>
        </div>

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
      )}

      {!listing && (
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
      )}
    </aside>
  )
}
