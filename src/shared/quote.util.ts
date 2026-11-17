/** Starts a reply in GitHub's quote-reply style: the comment's first paragraph quoted, then @author. */
export function quoteReply(body: string, author: string, maxChars = 400): string {
  const paragraph = body.trim().split(/\n\s*\n/)[0] ?? ''
  const clipped = paragraph.length > maxChars ? `${paragraph.slice(0, maxChars).trimEnd()}…` : paragraph
  const quoted = clipped
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n')
  return `${quoted}\n\n@${author} `
}
