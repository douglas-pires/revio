import { occurrences, type DiffMatch, type SearchOptions } from './diff-search.util'

/** Ranges over each occurrence of `query` in a code cell's text, which may span several token spans. Blame notes are skipped. */
export function rangesIn(cell: Element, query: string, options: SearchOptions): Range[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('.blame-note') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  const text = nodes.map((n) => n.data).join('')
  const starts: number[] = []
  let total = 0
  for (const n of nodes) {
    starts.push(total)
    total += n.data.length
  }
  // The text node holding character `i`, and the offset in it.
  const locate = (i: number, end: boolean): [Text, number] => {
    let k = nodes.length - 1
    while (k > 0 && (end ? starts[k]! >= i : starts[k]! > i)) k--
    return [nodes[k]!, i - starts[k]!]
  }
  return occurrences(text, query, options).map((at) => {
    const range = document.createRange()
    range.setStart(...locate(at, false))
    range.setEnd(...locate(at + query.length, true))
    return range
  })
}

/** The code cell a match is in, if its file is rendered. In split view a kept line shows twice; the new side is used. */
export function cellOf(match: DiffMatch): Element | null {
  const file = document.getElementById(`file-${match.path}`)
  const row = file?.querySelector(`tr[${match.side === 'LEFT' ? 'data-old-line' : 'data-new-line'}="${match.line}"]`)
  return row?.querySelector(`td[data-row][data-half="${match.side}"]`) ?? row?.querySelector('td[data-row]') ?? null
}
