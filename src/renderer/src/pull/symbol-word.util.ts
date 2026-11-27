const IDENTIFIER_CHAR = /[\w$]/u
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u

/** The identifier `offset` falls in within `text`, or null when it is not in one (or the word starts with a digit). */
export function readWordAt(text: string, offset: number): string | null {
  let start = offset
  let end = offset
  while (start > 0 && IDENTIFIER_CHAR.test(text[start - 1] ?? '')) {
    start -= 1
  }
  while (end < text.length && IDENTIFIER_CHAR.test(text[end] ?? '')) {
    end += 1
  }
  const word = text.slice(start, end)
  if (word.length < 2 || !IDENTIFIER.test(word)) {
    return null
  }
  return word
}

/** The selected text when it is one identifier, for finding its usages; null otherwise. */
export function readSelectedName(selected: string): string | null {
  const name = selected.trim()
  if (!IDENTIFIER.test(name) || name.length < 2) {
    return null
  }
  return name
}

/** The identifier under the pointer in the page, from the text the browser places the caret at; null when none. */
export function readWordAtPoint(x: number, y: number): string | null {
  const range = document.caretRangeFromPoint(x, y)
  const node = range?.startContainer
  if (!(range && node?.nodeType === Node.TEXT_NODE)) {
    return null
  }
  return readWordAt(node.textContent ?? '', range.startOffset)
}
