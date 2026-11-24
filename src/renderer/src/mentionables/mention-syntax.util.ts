/** A piece of a comment's text: a mention, or what is between mentions. */
export interface TextPiece {
  text: string
  mention: boolean
}

/** Code, which GitHub reads no mentions in, or "@" and a login or `org/team` that starts a word. */
const CODE_OR_MENTION =
  /(?<code>```[\s\S]*?(?:```|$)|`[^`\n]*`)|(?<![\w/`.@-])@[a-z\d](?:[a-z\d]|-(?=[a-z\d]))*(?:\/[\w-]+)?/giu

/** The comment split into mentions and the text between them; put together, the pieces are the whole text. */
export function splitMentions(text: string): TextPiece[] {
  const pieces: TextPiece[] = []
  let end = 0
  for (const match of text.matchAll(CODE_OR_MENTION)) {
    if (match.groups?.code === undefined) {
      pieces.push({ text: text.slice(end, match.index), mention: false }, { text: match[0], mention: true })
      end = match.index + match[0].length
    }
  }
  pieces.push({ text: text.slice(end), mention: false })
  return pieces.filter((piece) => piece.text !== '')
}
