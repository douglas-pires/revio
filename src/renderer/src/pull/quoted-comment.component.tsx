import { quoteReply } from '@shared/quote.util.ts'
import { useEffect, useRef, useState } from 'react'
import { ago, errorMessage } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import type { ConversationQuote } from '../common/navigation.types.ts'
import { Composer } from './composer.component.tsx'

const AVATAR_PX = 20

const WHERE: Record<ConversationQuote['kind'], string> = {
  description: 'in the description',
  comment: 'in a comment',
  review: 'in a review',
  'review-comment': 'in a review comment',
}

/** What the author did, for a comment picked in the comments panel rather than opened from a mention. */
const WROTE: Record<ConversationQuote['kind'], string> = {
  description: 'wrote the description',
  comment: 'commented',
  review: 'reviewed',
  'review-comment': 'commented on the code',
}

/** What the heading says after the author's name: why you are seeing this comment, and when it was written. */
function describeQuote({ quote, openedFrom }: QuotedConversation) {
  const when = `${ago(quote.createdAt)} ago`
  if (openedFrom === 'mention') {
    return `mentioned you ${WHERE[quote.kind]} · ${when}`
  }
  return `${WROTE[quote.kind]} · ${when}`
}

/** How the quoted comment was opened, which sets its heading and whether the reply box starts open. */
export type QuoteOpener = 'mention' | 'comments-panel'

/** A comment and how it was opened: from a mention, or by picking it in the comments panel. */
export interface QuotedConversation {
  quote: ConversationQuote
  openedFrom: QuoteOpener
}

/**
 * A conversation comment shown above the overview, since Revio has no conversation tab: the one you opened the PR
 * from (a mention), with the reply box open, or one you picked in the comments panel.
 */
export function QuotedComment({
  quoted,
  onReply,
  onDismiss,
}: {
  quoted: QuotedConversation
  onReply: (body: string) => Promise<{ url: string }>
  onDismiss: () => void
}) {
  const { quote } = quoted
  const ref = useRef<HTMLElement>(null)
  const [replying, setReplying] = useState(quoted.openedFrom === 'mention')
  const [sentUrl, setSentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'start' })
    ref.current?.classList.add('flash')
  }, [])
  return (
    <section ref={ref} data-quoted-comment={true} className="rounded-lg border border-accent/50 bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-[12px]">
        <img src={quote.authorAvatar} alt="" width={AVATAR_PX} height={AVATAR_PX} className="size-5 rounded-full" />
        <span className="font-semibold">{quote.author}</span>
        <span className="text-muted">{describeQuote(quoted)}</span>
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost py-0" onClick={() => globalThis.revio.openExternal(quote.url)}>
          Open on GitHub ↗
        </button>
        <button type="button" className="btn btn-ghost py-0" title="Hide" aria-label="Hide" onClick={onDismiss}>
          ✕
        </button>
      </div>
      <div className="px-4 py-3">
        <Markdown className="text-[12.5px]">{quote.body}</Markdown>
      </div>
      <div className="border-t border-line px-4 py-3">
        {sentUrl !== null && (
          <div className="flex items-center gap-2 text-[12px] text-ok">
            Replied in the conversation.
            <button type="button" className="btn btn-ghost py-0" onClick={() => globalThis.revio.openExternal(sentUrl)}>
              View on GitHub ↗
            </button>
          </div>
        )}
        {Boolean(sentUrl === null && replying) && (
          <>
            <Composer
              label="Reply in the conversation"
              initial={quoteReply(quote.body, quote.author)}
              unsentKey={`mention:${quote.url}`}
              onCancel={() => setReplying(false)}
              onSubmitNow={async (body) => {
                setError(null)
                try {
                  setSentUrl((await onReply(body)).url)
                } catch (e) {
                  setError(errorMessage(e))
                }
              }}
            />
            {error !== null && <div className="mt-1 text-[12px] text-danger">{error}</div>}
          </>
        )}
        {sentUrl === null && !replying && (
          <button type="button" className="input text-left text-muted" onClick={() => setReplying(true)}>
            Reply…
          </button>
        )}
      </div>
    </section>
  )
}
