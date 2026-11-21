import { addOffsets } from './numbered-lines.util.ts'

function FuzzyPiece({ text, matched }: { text: string; matched: boolean }) {
  if (!matched) {
    return <>{text}</>
  }
  return <mark className="rounded-sm bg-warn/30 text-fg">{text}</mark>
}

/** `text` with the characters a fuzzy match found (`positions`) marked. */
export function FuzzyText({ text, positions }: { text: string; positions: readonly number[] }) {
  if (positions.length === 0) {
    return <>{text}</>
  }
  const matched = new Set(positions)
  const parts: { text: string; matched: boolean }[] = []
  for (const [index, character] of [...text].entries()) {
    const last = parts.at(-1)
    if (last && last.matched === matched.has(index)) {
      last.text += character
    } else {
      parts.push({ text: character, matched: matched.has(index) })
    }
  }
  return (
    <>
      {addOffsets(parts).map((piece) => (
        <FuzzyPiece key={piece.offset} text={piece.text} matched={piece.matched} />
      ))}
    </>
  )
}
