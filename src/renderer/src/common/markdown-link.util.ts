const LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:'])
const WHITESPACE = /\s/u

/** The pasted text as a link, when it is one address and nothing else. */
function linkIn(pasted: string): string | null {
  const text = pasted.trim()
  if (text === '' || WHITESPACE.test(text) || !URL.canParse(text)) {
    return null
  }
  if (!LINK_SCHEMES.has(new URL(text).protocol)) {
    return null
  }
  return text
}

/**
 * What pasting `pasted` over the selected text should insert: `[selected](link)` when a link is pasted over words, as
 * GitHub does. Null leaves the paste alone: nothing selected, the paste is not a single link, or the selection is
 * already a link (then the paste replaces it).
 */
export function markdownLinkFor(selected: string, pasted: string): string | null {
  const link = linkIn(pasted)
  if (link === null || selected.trim() === '' || linkIn(selected) !== null) {
    return null
  }
  // Brackets in the words would end the link text early.
  const words = selected.replaceAll('[', String.raw`\[`).replaceAll(']', String.raw`\]`)
  return `[${words}](${link})`
}
