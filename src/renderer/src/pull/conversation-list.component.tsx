import { excerptAround } from '@shared/excerpt.util.ts'
import type { ConversationComment } from '@shared/pull.types.ts'
import { formatAge } from '../common/format.util.ts'
import { MatchText } from '../common/match-text.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'

/** Characters of a comment shown in the list, around a search match when there is one. */
const EXCERPT_CHARS = 160
const AVATAR_PX = 20

function ConversationEntry({
  comment,
  query,
  onOpen,
}: {
  comment: ConversationComment
  query: string
  onOpen: (comment: ConversationComment) => void
}) {
  return (
    <button
      type="button"
      className="flex w-full gap-2 rounded px-1.5 py-1.5 text-left hover:bg-hover"
      title="Show it on the overview, where you can reply"
      onClick={() => onOpen(comment)}
    >
      <img
        src={comment.authorAvatar}
        alt=""
        width={AVATAR_PX}
        height={AVATAR_PX}
        className="mt-0.5 size-5 shrink-0 rounded-full bg-panel-2"
      />
      <div className="min-w-0 flex-1 text-[12px]">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">
            <MatchText text={comment.author} query={query} />
          </span>
          {comment.kind === 'review' && <span className="font-mono text-[10.5px] text-muted">review</span>}
          <span className="ml-auto shrink-0 text-[10.5px] text-muted">{formatAge(comment.createdAt)}</span>
        </div>
        <div className="line-clamp-2 text-muted">
          <MatchText text={excerptAround(comment.body, query.trim(), EXCERPT_CHARS)} query={query} />
        </div>
      </div>
    </button>
  )
}

/** The PR's conversation comments in the comments panel; nothing when there are none (or none match). */
export function ConversationList({
  comments,
  query,
  onOpen,
}: {
  comments: readonly ConversationComment[]
  query: string
  onOpen: (comment: ConversationComment) => void
}) {
  if (comments.length === 0) {
    return null
  }
  return (
    <div className="mb-2">
      <SectionHeading title="Conversation" count={comments.length} className="mb-0 px-1.5 pt-1.5 pb-0.5" />
      {comments.map((comment) => (
        <ConversationEntry key={comment.id} comment={comment} query={query} onOpen={onOpen} />
      ))}
    </div>
  )
}
