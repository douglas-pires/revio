import { addOffsets } from './numbered-lines.util.ts'

const REGEXP_SPECIALS = /[.*+?^${}()|[\]\\]/gu

function MatchPiece({ text, matched }: { text: string; matched: boolean }) {
  if (!matched) {
    return <>{text}</>
  }
  return <mark className="rounded-sm bg-warn/30 text-fg">{text}</mark>
}

/** `text` with every case-insensitive occurrence of `query` marked. */
export function MatchText({ text, query }: { text: string; query: string }) {
  const needle = query.trim()
  if (!needle) {
    return <>{text}</>
  }
  // With the query in a capturing group, split keeps the matches: they are the odd-numbered pieces.
  const parts = text.split(new RegExp(`(${needle.replace(REGEXP_SPECIALS, '\\$&')})`, 'giu'))
  const pieces = addOffsets(parts.map((part, index) => ({ text: part, matched: index % 2 === 1 })))
  return (
    <>
      {pieces.map((piece) => (
        <MatchPiece key={piece.offset} text={piece.text} matched={piece.matched} />
      ))}
    </>
  )
}
