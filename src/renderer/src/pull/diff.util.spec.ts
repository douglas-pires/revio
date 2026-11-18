import { describe, expect, it } from 'vitest'
import { anchorFor, anchorOf, diffSnippet, keysOf, lineRangeOfRows, newSideText, snippetRows, parsePatch, parseRange, sliceAroundLine, toSplit, type DiffRow } from './diff.util'

const PATCH = ['@@ -10,4 +10,5 @@ function f() {', ' keep', '-old', '+new', '+extra', ' tail', '\\ No newline at end of file'].join('\n')

describe('parsePatch', () => {
  it('numbers old and new lines from the hunk header', () => {
    expect(parsePatch(PATCH)).toEqual([
      { kind: 'hunk', text: '@@ -10,4 +10,5 @@ function f() {', oldStart: 10, newStart: 10 },
      { kind: 'ctx', text: 'keep', oldNo: 10, newNo: 10 },
      { kind: 'del', text: 'old', oldNo: 11, newNo: null },
      { kind: 'add', text: 'new', oldNo: null, newNo: 11 },
      { kind: 'add', text: 'extra', oldNo: null, newNo: 12 },
      { kind: 'ctx', text: 'tail', oldNo: 12, newNo: 13 },
    ])
  })

  it('restarts numbering at each hunk and accepts headers without counts', () => {
    const rows = parsePatch('@@ -1 +1 @@\n-a\n+b\n@@ -50,2 +60,2 @@\n x')
    expect(rows.at(-1)).toEqual({ kind: 'ctx', text: 'x', oldNo: 50, newNo: 60 })
  })
})

describe('anchors', () => {
  const [, ctx, del, add] = parsePatch(PATCH) as DiffRow[]

  it('attaches deletions to the left side and everything else to the right', () => {
    expect(anchorOf(del!)).toEqual({ side: 'LEFT', line: 11 })
    expect(anchorOf(add!)).toEqual({ side: 'RIGHT', line: 11 })
    expect(anchorOf(ctx!)).toEqual({ side: 'RIGHT', line: 10 })
  })

  it('picks the requested half in split view, or nothing when that half is empty', () => {
    expect(anchorFor(ctx!, 'LEFT')).toEqual({ side: 'LEFT', line: 10 })
    expect(anchorFor(add!, 'LEFT')).toBeNull()
    expect(anchorFor(del!, 'RIGHT')).toBeNull()
  })

  it('gives context lines keys on both sides', () => {
    expect(keysOf(ctx!)).toEqual(['RIGHT:10', 'LEFT:10'])
    expect(keysOf(ctx!, 'LEFT')).toEqual(['LEFT:10'])
    expect(keysOf(del!)).toEqual(['LEFT:11'])
  })
})

describe('parseRange', () => {
  it.each([
    ['42-80', [42, 80]],
    ['80 - 42', [42, 80]],
    [' 7 ', [7, 7]],
  ] as const)('parses %j', (input, expected) => expect(parseRange(input)).toEqual(expected))

  it.each(['', 'abc', '1-', '1,2'])('rejects %j', (input) => expect(parseRange(input)).toBeNull())
})

describe('toSplit', () => {
  it('pairs a removed run with the added run that follows it', () => {
    const rows = parsePatch(PATCH)
    expect(toSplit(rows)).toEqual([
      { kind: 'hunk', idx: 0 },
      { kind: 'pair', left: 1, right: 1 },
      { kind: 'pair', left: 2, right: 3 },
      { kind: 'pair', left: null, right: 4 },
      { kind: 'pair', left: 5, right: 5 },
    ])
  })

  it('does not pair additions with deletions that come after them', () => {
    const rows = parsePatch('@@ -1,1 +1,1 @@\n+a\n-b')
    expect(toSplit(rows)).toEqual([
      { kind: 'hunk', idx: 0 },
      { kind: 'pair', left: null, right: 1 },
      { kind: 'pair', left: 2, right: null },
    ])
  })
})

describe('sliceAroundLine', () => {
  const rows = parsePatch(['@@ -1,6 +1,6 @@', ' a', ' b', '-c', '+C', ' d', ' e', '@@ -40,2 +40,2 @@', ' x', ' y'].join('\n'))
  const newLines = (slice: ReturnType<typeof sliceAroundLine>) => slice.map((r) => `${r.kind}:${r.newNo ?? r.oldNo}`)

  it('takes rows around the line, deleted rows included', () => {
    expect(newLines(sliceAroundLine(rows, 3, 1))).toEqual(['del:3', 'add:3', 'ctx:4'])
  })

  it('stops at hunk boundaries', () => {
    expect(newLines(sliceAroundLine(rows, 40, 3))).toEqual(['ctx:40', 'ctx:41'])
    expect(newLines(sliceAroundLine(rows, 1, 2))).toEqual(['ctx:1', 'ctx:2', 'del:3'])
  })

  it('is empty when the line is not part of the diff', () => {
    expect(sliceAroundLine(rows, 20)).toEqual([])
  })
})

describe('diffSnippet', () => {
  const rows = parsePatch(PATCH)

  it('marks added and removed rows across the new-side range', () => {
    expect(diffSnippet(rows, 'RIGHT', 10, 11)).toBe(' keep\n-old\n+new')
  })

  it('leaves out added rows for an old-side range', () => {
    expect(diffSnippet(rows, 'LEFT', 11, 12)).toBe('-old\n tail')
  })

  it('is empty when no row is in range', () => {
    expect(diffSnippet(rows, 'RIGHT', 90, 95)).toBe('')
  })
})

describe('newSideText', () => {
  it('joins the new-side text of the range', () => {
    expect(newSideText(parsePatch(PATCH), 11, 12)).toBe('new\nextra')
  })
})

describe('lineRangeOfRows', () => {
  const rows = parsePatch(PATCH)

  it('uses the new side unless only deleted rows are selected', () => {
    expect(lineRangeOfRows(rows, 1, 4)).toEqual({ side: 'RIGHT', start: 10, end: 12 })
    expect(lineRangeOfRows(rows, 2, 2)).toEqual({ side: 'LEFT', start: 11, end: 11 })
  })

  it('keeps the split-view half the selection started in, in either order', () => {
    expect(lineRangeOfRows(rows, 5, 1, 'LEFT')).toEqual({ side: 'LEFT', start: 10, end: 12 })
  })

  it('is null for a selection over the hunk header only', () => {
    expect(lineRangeOfRows(rows, 0, 0)).toBeNull()
  })
})

describe('snippetRows', () => {
  const rows = parsePatch(PATCH)

  it('reads back a new-side snippet, numbering new-side lines', () => {
    expect(snippetRows(diffSnippet(rows, 'RIGHT', 10, 11), 'RIGHT', 10).map((r) => [r.kind, r.text, r.newNo])).toEqual([
      ['ctx', 'keep', 10],
      ['del', 'old', null],
      ['add', 'new', 11],
    ])
  })

  it('numbers old-side lines for an old-side snippet', () => {
    expect(snippetRows(diffSnippet(rows, 'LEFT', 11, 12), 'LEFT', 11).map((r) => [r.kind, r.oldNo])).toEqual([
      ['del', 11],
      ['ctx', 12],
    ])
  })
})
