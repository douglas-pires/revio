import { type RefObject, useMemo } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { addOffsets } from '../common/numbered-lines.util.ts'
import { splitMentions } from './mention-syntax.util.ts'

/**
 * What a comment box shows: its text with the mentions coloured, behind a box whose own text is transparent. It takes
 * the box's classes, so the text wraps alike, and is scrolled along with it.
 */
export function MentionHighlight(props: {
  layer: RefObject<HTMLDivElement | null>
  text: string
  className?: string | undefined
}) {
  const pieces = useMemo(() => addOffsets(splitMentions(props.text)), [props.text])
  return (
    <div
      ref={props.layer}
      aria-hidden={true}
      className={joinClassNames(
        props.className,
        'pointer-events-none absolute inset-0 resize-none overflow-hidden border-transparent break-words whitespace-pre-wrap [scrollbar-gutter:stable]',
      )}
    >
      {pieces.map((piece) => (
        <span key={piece.offset} className={joinClassNames(piece.mention && 'rounded-sm bg-accent/15 text-accent')}>
          {piece.text}
        </span>
      ))}
      {/* Keeps the height of a last, empty line. */}
      {'​'}
    </div>
  )
}
