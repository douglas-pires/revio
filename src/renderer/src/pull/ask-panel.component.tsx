import type { AskMessage as AskMessageType, AskThread } from '@shared/claude.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CopyButton } from '../common/copy-button.component.tsx'
import { cx } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { withPositions } from '../common/numbered-lines.util.ts'
import { AskHistory } from './ask-history.component.tsx'
import { snippetRows } from './diff.util.ts'
import { StaticDiff } from './static-diff.component.tsx'
import { useAskConversation } from './use-ask-conversation.hook.ts'
import { useStickToBottom } from './use-stick-to-bottom.hook.ts'

const QUICK = [
  'What does this change do, and why?',
  'Is this safe? Which edge cases or inputs could break it?',
  'How does this interact with the rest of the PR?',
  'Draft a review comment for this.',
]

/** "12" or "12–14". */
function linesOf(thread: AskThread) {
  if (thread.startLine === thread.endLine) {
    return `${thread.startLine}`
  }
  return `${thread.startLine}–${thread.endLine}`
}

function placeholderFor(thread: AskThread) {
  if (thread.messages.length > 0) {
    return 'Follow up…'
  }
  return 'Ask about the selected code… (↵ to send, ⇧↵ for newline)'
}

/** One message: your question, or Claude's answer with shortcuts to draft or copy it. */
function AskMessage({ message, onUseAsDraft }: { message: AskMessageType; onUseAsDraft: (body: string) => void }) {
  if (message.role === 'user') {
    return (
      <div className="selectable ml-8 rounded-lg bg-accent/15 px-3 py-2 whitespace-pre-wrap">{message.content}</div>
    )
  }
  return (
    <div className="group">
      <Markdown className="text-[13px]">{message.content}</Markdown>
      <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button type="button" className="btn py-0" onClick={() => onUseAsDraft(message.content)}>
          + Use as draft comment
        </button>
        <button
          type="button"
          className="btn btn-ghost py-0"
          onClick={() => navigator.clipboard.writeText(message.content)}
        >
          Copy
        </button>
      </div>
    </div>
  )
}

/** The answer as it streams in, or a waiting note before the first words. */
function PendingAnswer({ text }: { text: string }) {
  if (!text) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <span className="size-2 animate-pulse rounded-full bg-accent" /> Reading the file and the PR…
      </div>
    )
  }
  return <Markdown className="text-[13px]">{text}</Markdown>
}

/** The selected code with a link to it and a copy button. */
function SelectionSnippet({ thread, onJump }: { thread: AskThread; onJump: (path: string, line: number) => void }) {
  const rows = useMemo(
    () => snippetRows(thread.snippet, thread.side, thread.startLine),
    [thread.snippet, thread.side, thread.startLine],
  )
  const lines = linesOf(thread)
  return (
    <>
      <button
        type="button"
        className="block w-full truncate text-left font-mono text-[11.5px] text-accent hover:underline"
        title={`${thread.path}:${lines}`}
        onClick={() => onJump(thread.path, thread.endLine)}
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
    </>
  )
}

interface AskPanelProps {
  pull: PullRef
  thread: AskThread
  history: AskThread[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onChange: (thread: AskThread) => void
  onClose: () => void
  onJump: (path: string, line: number) => void
  onUseAsDraft: (thread: AskThread, body: string) => void
}

/** The conversation: the selection, each message, the answer streaming in, and starter questions. */
function AskConversation({
  props,
  chat,
  scroller,
  onScroll,
}: {
  props: AskPanelProps
  chat: ReturnType<typeof useAskConversation>
  scroller: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
}) {
  const { thread } = props
  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3 py-3"
    >
      <SelectionSnippet thread={thread} onJump={props.onJump} />
      {withPositions(thread.messages).map(({ item, position }) => (
        <AskMessage key={position} message={item} onUseAsDraft={(body) => props.onUseAsDraft(thread, body)} />
      ))}
      {chat.pending !== null && <PendingAnswer text={chat.pending} />}
      {chat.error !== null && <p className="selectable text-danger">{chat.error}</p>}
      {thread.messages.length === 0 && chat.pending === null && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button type="button" key={q} className="btn text-left" onClick={() => chat.send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Where you type the question: ↵ sends, ⇧↵ adds a line, Escape closes the panel. */
function QuestionBox({
  input,
  thread,
  chat,
  onClose,
}: {
  input: React.RefObject<HTMLTextAreaElement | null>
  thread: AskThread
  chat: ReturnType<typeof useAskConversation>
  onClose: () => void
}) {
  return (
    <div className="border-t border-line p-3">
      <textarea
        ref={input}
        aria-label="Question for Claude"
        className="input min-h-16 resize-none"
        placeholder={placeholderFor(thread)}
        value={chat.question}
        disabled={chat.pending !== null}
        onChange={(e) => chat.setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            chat.send(chat.question)
          }
          if (e.key === 'Escape') {
            onClose()
          }
        }}
      />
    </div>
  )
}

/**
 * The conversation follows the answer as it streams while you are at the bottom, and leaves you where you are once you
 * scroll up to read. Opening a chat, or sending a question, takes you to the bottom.
 */
function useChatScroll(scroller: React.RefObject<HTMLDivElement | null>, thread: AskThread, pending: string | null) {
  const stick = useStickToBottom(scroller)
  const { follow, jump } = stick
  const lastRole = thread.messages.at(-1)?.role
  // biome-ignore lint/correctness/useExhaustiveDependencies: new messages and streamed text are the triggers; each follows to the bottom unless you scrolled up.
  useEffect(() => {
    follow()
  }, [thread.messages.length, pending, follow])
  // biome-ignore lint/correctness/useExhaustiveDependencies: thread.id is the trigger; another chat opens at its latest message.
  useEffect(() => {
    jump()
  }, [thread.id, jump])
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new message is the trigger; your own question takes you down to read the answer as it comes.
  useEffect(() => {
    if (lastRole === 'user') {
      jump()
    }
  }, [thread.messages.length, lastRole, jump])
  return stick
}

export function AskPanel(props: AskPanelProps) {
  const { thread } = props
  const chat = useAskConversation(props.pull, thread, props.onChange)
  /** Showing the list of chats instead of the current one. */
  const [listing, setListing] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const { setError } = chat

  // biome-ignore lint/correctness/useExhaustiveDependencies: thread.id is the trigger; switching threads focuses the box and clears its state.
  useEffect(() => {
    input.current?.focus()
    setError(null)
    setListing(false)
  }, [thread.id])

  const stick = useChatScroll(scroller, thread, chat.pending)

  return (
    <aside className="flex w-[440px] shrink-0 flex-col border-l border-line bg-panel">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-accent">✦</span>
        <span className="font-semibold">Ask Claude</span>
        <div className="flex-1" />
        {props.history.length > 1 && (
          <button
            type="button"
            className={cx('btn py-0.5', listing && 'btn-primary')}
            onClick={() => setListing(!listing)}
            aria-pressed={listing}
          >
            Chats {props.history.length}
          </button>
        )}
        <button type="button" className="btn btn-ghost px-1.5" onClick={props.onClose} title="Close">
          ✕
        </button>
      </header>
      {Boolean(listing) && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <AskHistory
            threads={props.history}
            currentId={thread.id}
            onOpen={(id) => {
              if (id === thread.id) {
                setListing(false)
              } else {
                props.onSelect(id)
              }
            }}
            onDelete={props.onDelete}
          />
        </div>
      )}
      {!listing && (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <AskConversation props={props} chat={chat} scroller={scroller} onScroll={stick.onScroll} />
          {Boolean(stick.away) && (
            <button
              type="button"
              className="btn absolute bottom-2 left-1/2 -translate-x-1/2 bg-panel-2 shadow-lg"
              onClick={stick.jump}
            >
              ↓ Latest
            </button>
          )}
        </div>
      )}
      {!listing && <QuestionBox input={input} thread={thread} chat={chat} onClose={props.onClose} />}
    </aside>
  )
}
