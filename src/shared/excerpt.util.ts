/** A match this early in the text is shown from the start; a later one gets this much lead-in before it. */
const EARLY_MATCH_SHARE = 0.6
const LEAD_IN_SHARE = 0.3

const NAMED_ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const ENTITY = /&(?:#(?<decimal>\d+)|#x(?<hex>[\da-f]+)|(?<name>[a-z]+));/giu
const MARKDOWN_IMAGE = /!\[(?<alt>[^\]]*)\]\([^)]*\)/gu
/** Blockquote (`>`) and heading (`#`) markers at the start of a line; elsewhere `>` and `#` are text (`a > b`, `#12`). */
const LINE_MARKERS = /^[ \t]*(?:>+|#{1,6})[ \t]*/gmu
const MARKDOWN_LINK = /\[(?<label>[^\]]*)\]\([^)]*\)/gu

/** `&nbsp;`, `&amp;`, `&#39;` and `&#x1F600;` as the characters they stand for; unknown names stay as written. */
function decodeHtmlEntities(text: string) {
  return text.replace(ENTITY, (entity, ...rest) => {
    const { decimal, hex, name } = rest.at(-1) as Record<string, string | undefined>
    if (decimal) {
      return String.fromCodePoint(Number(decimal))
    }
    if (hex) {
      return String.fromCodePoint(Number.parseInt(hex, 16))
    }
    return NAMED_ENTITIES[name?.toLowerCase() ?? ''] ?? entity
  })
}

/**
 * A comment as one plain line: code named, HTML tags dropped and entities decoded (tags first, so an encoded `&lt;b&gt;`
 * never becomes markup), links reduced to their text, images to their alt text, quote and heading markers and emphasis removed.
 */
function toPlainText(body: string) {
  const withoutMarkup = body
    .replace(/```suggestion[\s\S]*?```/gu, '[suggested change]')
    .replace(/```[\s\S]*?```/gu, '[code]')
    .replace(/<[^>]+>/gu, ' ')
  return decodeHtmlEntities(withoutMarkup)
    .replace(MARKDOWN_IMAGE, '$<alt>')
    .replace(MARKDOWN_LINK, '$<label>')
    .replace(LINE_MARKERS, '')
    .replace(/[*_`]/gu, '')
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
