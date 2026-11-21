import type { DiffSide } from '@shared/pull.types.ts'
import { type DiffMatch, occurrences, type SearchOptions } from './diff-search.util.ts'

/** The row attribute holding a line number, by side. */
const LINE_ATTRIBUTES: Record<DiffSide, string> = { LEFT: 'data-old-line', RIGHT: 'data-new-line' }

/** Text inside a blame note is not part of the code. */
function acceptUnlessInBlameNote(node: Node) {
  if (node.parentElement?.closest('.blame-note')) {
    return NodeFilter.FILTER_REJECT
  }
  return NodeFilter.FILTER_ACCEPT
}

/**
 * The text node holding character `i` of the joined text, and the offset in it. An end position at a node boundary
 * stays in the earlier node, so a range never ends at offset 0 of the next one.
 */
function locate(
  nodes: readonly Text[],
  starts: readonly number[],
  textOffset: number,
  end: boolean,
): [Text, number] | null {
  const nodeIndex = starts.findLastIndex(
    (offset, position) => position === 0 || offset < textOffset || (!end && offset === textOffset),
  )
  const node = nodes[nodeIndex]
  const start = starts[nodeIndex]
  if (node === undefined || start === undefined) {
    return null
  }
  return [node, textOffset - start]
}

/** Ranges over each occurrence of `query` in a code cell's text, which may span several token spans. Blame notes are skipped. */
export function rangesIn(cell: Element, query: string, options: SearchOptions): Range[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => acceptUnlessInBlameNote(node),
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text)
  }
  const text = nodes.map((node) => node.data).join('')
  const starts: number[] = []
  let total = 0
  for (const node of nodes) {
    starts.push(total)
    total += node.data.length
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
