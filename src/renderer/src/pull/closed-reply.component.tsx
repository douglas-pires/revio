import { forgetUnsentComment, useUnsentComment } from './unsent-comments.util.ts'
import { UnsentNote } from './unsent-note.component.tsx'

/** What the reply box leaves in its place while closed: what you left in it, or the way to open it. */
export function ClosedReply({ unsentKey, onOpen }: { unsentKey: string; onOpen: () => void }) {
  const unsentBody = useUnsentComment(unsentKey)
  if (unsentBody !== undefined) {
    return (
      <UnsentNote
        label="Reply"
        body={unsentBody}
        onContinue={onOpen}
        onDiscard={() => forgetUnsentComment(unsentKey)}
      />
    )
  }
  return (
    <button type="button" className="input text-left text-muted" onClick={onOpen}>
      Reply…
    </button>
  )
}
