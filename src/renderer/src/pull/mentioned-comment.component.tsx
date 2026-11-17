import { useEffect, useRef } from 'react'
import { ago } from '../common/format.util'
import { Markdown } from '../common/markdown.component'
import type { ConversationQuote } from '../common/navigation.types'

const WHERE: Record<ConversationQuote['kind'], string> = {
  description: 'in the description',
  comment: 'in a comment',
  review: 'in a review',
  'review-comment': 'in a review comment',
}

/** The conversation comment you opened the PR from, shown above the overview since Revio has no conversation tab. */
export function MentionedComment({ quote, onDismiss }: { quote: ConversationQuote; onDismiss: () => void }) {
  const ref = useRef<HTMLElement>(null)
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
          Reply on GitHub ↗
        </button>
        <button className="btn btn-ghost py-0" title="Hide" aria-label="Hide" onClick={onDismiss}>
          ✕
        </button>
      </div>
      <div className="px-4 py-3">
        <Markdown className="text-[12.5px]">{quote.body}</Markdown>
      </div>
    </section>
  )
}
