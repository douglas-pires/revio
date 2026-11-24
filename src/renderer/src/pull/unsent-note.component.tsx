import { excerptAround } from '@shared/excerpt.util.ts'
import { joinClassNames } from '../common/format.util.ts'

/** Characters of the text shown in the note. */
const EXCERPT_CHARS = 160

/** Marks a place where a comment box was closed with text in it: what it says, and the ways to go on or drop it. */
export function UnsentNote(props: {
  /** What the text is: the lines it is on, or that it is a reply. */
  label: string
  body: string
  onContinue: () => void
  onDiscard: () => void
  className?: string
}) {
  return (
    <div
      data-unsent-note={true}
      className={joinClassNames(
        'flex items-center gap-2 rounded-md border border-dashed border-warn/60 bg-warn/5 px-3 py-1.5 text-[12px]',
        props.className,
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-fg"
        title="Continue writing"
        onClick={props.onContinue}
      >
        <span className="chip shrink-0 bg-warn/20 text-warn">✎ Not sent</span>
        <span className="shrink-0 text-muted">{props.label}</span>
        <span className="min-w-0 truncate">{excerptAround(props.body, '', EXCERPT_CHARS)}</span>
      </button>
      <button type="button" className="btn btn-ghost shrink-0 py-0" onClick={props.onContinue}>
        Continue
      </button>
      <button type="button" className="btn btn-ghost shrink-0 py-0 text-danger" onClick={props.onDiscard}>
        Discard
      </button>
    </div>
  )
}
