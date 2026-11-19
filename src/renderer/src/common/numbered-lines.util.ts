/** A line of text with its 1-based number, which identifies it in a list (a stable React key). */
export interface NumberedLine {
  number: number
  text: string
}

export function numberLines(text: string): NumberedLine[] {
  return text.split('\n').map((line, i) => ({ number: i + 1, text: line }))
}

/** Pieces of a line with where each starts, which identifies it among its siblings (a stable React key). */
export function withOffsets<T extends { text: string }>(pieces: readonly T[]): (T & { offset: number })[] {
  let offset = 0
  return pieces.map((piece) => {
    const placed = { ...piece, offset }
    offset += piece.text.length
    return placed
  })
}

/** Items with their 1-based position, for append-only lists where the position is the identity (a stable React key). */
export function withPositions<T>(items: readonly T[]): { item: T; position: number }[] {
  return items.map((item, i) => ({ item, position: i + 1 }))
}
