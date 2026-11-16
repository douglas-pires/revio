import { describe, expect, it } from 'vitest'
import { anchorFor, anchorOf, keysOf, parsePatch, parseRange, toSplit, type DiffRow } from '@/pull/diff.util'

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
