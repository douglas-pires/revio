/** A match this early in the text is shown from the start; a later one gets this much lead-in before it. */
const EARLY_MATCH_SHARE = 0.6
const LEAD_IN_SHARE = 0.3

function toPlainText(body: string) {
  return body
    .replace(/```suggestion[\s\S]*?```/gu, '[suggested change]')
    .replace(/```[\s\S]*?```/gu, '[code]')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/[*_`>#]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** One readable line from a markdown comment: suggestions and code blocks are named, not shown. */
export function summarizeComment(body: string, max = 280) {
  return toPlainText(body).slice(0, max)
}

/** The readable text around the first @handle, so a long comment still shows why you were mentioned. */
export function summarizeAround(body: string, handle: string, max = 280) {
  return excerptAround(body, `@${handle}`, max)
}

/** The readable text around the first case-insensitive match of `needle`, from the start when it is early or missing. */
export function excerptAround(body: string, needle: string, max = 280) {
  const text = toPlainText(body)
  const at = text.toLowerCase().indexOf(needle.toLowerCase())
  if (!needle || at < max * EARLY_MATCH_SHARE) {
    return text.slice(0, max)
  }
  const start = Math.max(0, at - Math.round(max * LEAD_IN_SHARE))
  return `…${text.slice(start, start + max)}`
}
