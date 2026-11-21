import { excerptAround } from '@shared/excerpt.util.ts'
import type { DraftComment } from '@shared/pull.types.ts'
import { MatchText } from '../common/match-text.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { readNewSideLine } from './comments-panel.util.ts'

/** Characters of a draft shown in the panel, around a search match when there is one. */
const EXCERPT_CHARS = 200

/** Where a draft sits: its file name, then its line, "file" for a file comment, and "reply" for a reply. */
function DraftPlace({ draft }: { draft: DraftComment }) {
  return (
    <span className="font-mono text-[10.5px] text-muted">
      {draft.path.slice(draft.path.lastIndexOf('/') + 1)}
      {draft.line === null && ' · file'}
      {draft.line !== null && `:${draft.line}`}
      {Boolean(draft.inReplyTo) && ' · reply'}
    </span>
  )
}

/** Your comments not sent yet, at the top of the comments panel. Click one to jump to its line. */
export function PendingDrafts({
  drafts,
  query,
  onJump,
}: {
  drafts: readonly DraftComment[]
  query: string
  onJump: (path: string, line: number | null) => void
}) {
  return (
    <div className="mb-2 rounded-md border border-accent/30 bg-accent/5 pb-1">
      <SectionHeading
        title="Your pending comments"
        count={drafts.length}
        tone="accent"
        className="mb-0 px-1.5 pt-1.5 pb-0.5"
      />
      {drafts.map((draft) => (
        <button
          type="button"
          key={draft.id}
          className="block w-full rounded px-1.5 py-1 text-left text-[12px] hover:bg-hover"
          onClick={() => onJump(draft.path, readNewSideLine(draft.side, draft.line))}
        >
          <DraftPlace draft={draft} />
          <div className="line-clamp-2">
            <MatchText text={excerptAround(draft.body, query.trim(), EXCERPT_CHARS)} query={query} />
          </div>
        </button>
      ))}
    </div>
  )
}
