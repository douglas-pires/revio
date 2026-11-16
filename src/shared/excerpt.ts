/** One readable line from a markdown comment: suggestions and code blocks are named, not shown. */
export function summarizeComment(body: string, max = 280) {
  return toPlainText(body).slice(0, max)
}

/** The readable text around the first @handle, so a long comment still shows why you were mentioned. */
export function summarizeAround(body: string, handle: string, max = 280) {
  const text = toPlainText(body)
  const at = text.toLowerCase().indexOf(`@${handle.toLowerCase()}`)
  if (at < max * 0.6) return text.slice(0, max)
  const start = Math.max(0, at - Math.round(max * 0.3))
  return `…${text.slice(start, start + max)}`
}

function toPlainText(body: string) {
  return body
    .replace(/```suggestion[\s\S]*?```/g, '[suggested change]')
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
