const PARAGRAPH_BREAK = /\n\s*\n/u

/** Starts a reply in GitHub's quote-reply style: the comment's first paragraph quoted, then @author. */
export function quoteReply(body: string, author: string, maxChars = 400): string {
  const paragraph = body.trim().split(PARAGRAPH_BREAK)[0] ?? ''
  let clipped = paragraph
  if (paragraph.length > maxChars) {
    clipped = `${paragraph.slice(0, maxChars).trimEnd()}…`
  }
  const quoted = clipped
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n')
  return `${quoted}\n\n@${author} `
}
