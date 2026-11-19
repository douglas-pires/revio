import type { DiffSide } from '@shared/pull.types.ts'
import { type DiffMatch, occurrences, type SearchOptions } from './diff-search.util.ts'

/** The row attribute holding a line number, by side. */
const LINE_ATTRIBUTES: Record<DiffSide, string> = { LEFT: 'data-old-line', RIGHT: 'data-new-line' }

/** Text inside a blame note is not part of the code. */
function acceptUnlessInBlameNote(n: Node) {
  if (n.parentElement?.closest('.blame-note')) {
    return NodeFilter.FILTER_REJECT
  }
  return NodeFilter.FILTER_ACCEPT
}

/**
 * The text node holding character `i` of the joined text, and the offset in it. An end position at a node boundary
 * stays in the earlier node, so a range never ends at offset 0 of the next one.
 */
function locate(nodes: readonly Text[], starts: readonly number[], i: number, end: boolean): [Text, number] | null {
  const k = starts.findLastIndex((offset, idx) => idx === 0 || offset < i || (!end && offset === i))
  const node = nodes[k]
  const start = starts[k]
  if (node === undefined || start === undefined) {
    return null
  }
  return [node, i - start]
}

/** Ranges over each occurrence of `query` in a code cell's text, which may span several token spans. Blame notes are skipped. */
export function rangesIn(cell: Element, query: string, options: SearchOptions): Range[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => acceptUnlessInBlameNote(n),
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n as Text)
  }
  const text = nodes.map((n) => n.data).join('')
  const starts: number[] = []
  let total = 0
  for (const n of nodes) {
    starts.push(total)
    total += n.data.length
  }
  return occurrences(text, query, options).flatMap((at) => {
    const start = locate(nodes, starts, at, false)
    const end = locate(nodes, starts, at + query.length, true)
    if (!(start && end)) {
      return []
    }
    const range = document.createRange()
    range.setStart(...start)
    range.setEnd(...end)
    return [range]
  })
}

/** The code cell a match is in, if its file is rendered. In split view a kept line shows twice; the new side is used. */
export function cellOf(match: DiffMatch): Element | null {
  const file = document.querySelector(`#${CSS.escape(`file-${match.path}`)}`)
  const row = file?.querySelector(`tr[${LINE_ATTRIBUTES[match.side]}="${match.line}"]`)
  return row?.querySelector(`td[data-row][data-half="${match.side}"]`) ?? row?.querySelector('td[data-row]') ?? null
}
