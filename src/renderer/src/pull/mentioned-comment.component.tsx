import { useEffect, useRef, useState } from 'react'
import { quoteReply } from '@shared/quote.util'
import { ago, errorMessage } from '../common/format.util'
import { Markdown } from '../common/markdown.component'
import type { ConversationQuote } from '../common/navigation.types'
import { Composer } from './review-comments.component'

const WHERE: Record<ConversationQuote['kind'], string> = {
  description: 'in the description',
  comment: 'in a comment',
  review: 'in a review',
  'review-comment': 'in a review comment',
}

/** The conversation comment you opened the PR from, shown above the overview since Revio has no conversation tab. */
export function MentionedComment({ quote, onReply, onDismiss }: { quote: ConversationQuote; onReply: (body: string) => Promise<{ url: string }>; onDismiss: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const [replying, setReplying] = useState(true)
  const [sentUrl, setSentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'start' })
    ref.current?.classList.add('flash')
  }, [])
  return (
    <section ref={ref} data-mentioned-comment className="rounded-lg border border-accent/50 bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-[12px]">
        <img src={quote.authorAvatar} alt="" className="size-5 rounded-full" />
        <span className="font-semibold">{quote.author}</span>
        <span className="text-muted">
          mentioned you {WHERE[quote.kind]} · {ago(quote.createdAt)} ago
        </span>
        <div className="flex-1" />
        <button className="btn btn-ghost py-0" onClick={() => void window.revio.openExternal(quote.url)}>
          Open on GitHub ↗
        </button>
        <button className="btn btn-ghost py-0" title="Hide" aria-label="Hide" onClick={onDismiss}>
          ✕
        </button>
      </div>
      <div className="px-4 py-3">
        <Markdown className="text-[12.5px]">{quote.body}</Markdown>
      </div>
      <div className="border-t border-line px-4 py-3">
        {sentUrl ? (
          <div className="flex items-center gap-2 text-[12px] text-ok">
            Replied in the conversation.
            <button className="btn btn-ghost py-0" onClick={() => void window.revio.openExternal(sentUrl)}>
              View on GitHub ↗
            </button>
          </div>
        ) : replying ? (
          <>
            <Composer
              label="Reply in the conversation"
              initial={quoteReply(quote.body, quote.author)}
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
            {error && <div className="mt-1 text-[12px] text-danger">{error}</div>}
          </>
        ) : (
          <button className="input text-left text-muted" onClick={() => setReplying(true)}>
            Reply…
          </button>
        )}
      </div>
    </section>
  )
}
