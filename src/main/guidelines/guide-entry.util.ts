/** The section of a guide that entries made from review comments go under. */
const ENTRIES_HEADING = '## From review comments'

/** The entry as one markdown bullet: its lines joined, so a multi-line comment stays one point. */
function formatBullet(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return `- ${lines.join(' ')}`
}

/** The guide's text with `text` added as a bullet at the end of the "From review comments" section, made if missing. */
export function appendGuideEntry(body: string, text: string): string {
  const bullet = formatBullet(text)
  const lines = body.trimEnd().split('\n')
  const heading = lines.indexOf(ENTRIES_HEADING)
  if (heading < 0) {
    const before = body.trimEnd()
    if (!before) {
      return `${ENTRIES_HEADING}\n${bullet}\n`
    }
    return `${before}\n\n${ENTRIES_HEADING}\n${bullet}\n`
  }
  let next = lines.findIndex((line, index) => index > heading && line.startsWith('#'))
  if (next < 0) {
    next = lines.length
  }
  let end = next
  while (end > heading + 1 && !lines[end - 1]?.trim()) {
    end--
  }
  return `${[...lines.slice(0, end), bullet, ...lines.slice(end)].join('\n')}\n`
}
