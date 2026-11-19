import { withOffsets } from './numbered-lines.util.ts'

const REGEXP_SPECIALS = /[.*+?^${}()|[\]\\]/gu

function MatchPiece({ text, matched }: { text: string; matched: boolean }) {
  if (!matched) {
    return <>{text}</>
  }
  return <mark className="rounded-sm bg-warn/30 text-fg">{text}</mark>
}

/** `text` with every case-insensitive occurrence of `query` marked. */
export function MatchText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) {
    return <>{text}</>
  }
  // With the query in a capturing group, split keeps the matches: they are the odd-numbered pieces.
  const parts = text.split(new RegExp(`(${q.replace(REGEXP_SPECIALS, '\\$&')})`, 'giu'))
  const pieces = withOffsets(parts.map((part, i) => ({ text: part, matched: i % 2 === 1 })))
  return (
    <>
      {pieces.map((p) => (
        <MatchPiece key={p.offset} text={p.text} matched={p.matched} />
      ))}
    </>
  )
}
