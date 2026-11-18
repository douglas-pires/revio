import { describe, expect, it } from 'vitest'
import { parsePatch, type DiffRow } from './diff.util'
import { EXPAND_STEP, expandGap, expandRows, gapsOf, hiddenIn, type GapShown } from './diff-expand.util'

// A 40-line file; line n reads "n". The PR changes line 10 and adds a line after old line 30.
const file = Array.from({ length: 40 }, (_, i) => `${i + 1}`)
const patch = [
  '@@ -8,5 +8,5 @@ fn',
  ' 8',
  ' 9',
  '-10 old',
  '+10',
  ' 11',
  ' 12',
  '@@ -30,0 +31,1 @@',
  '+31 new',
].join('\n')
const rows = parsePatch(patch)
const newNos = (out: DiffRow[]) => out.map((r) => (r.kind === 'hunk' ? `@${r.gap ? r.gap.hidden : '-'}` : r.newNo))

describe('gapsOf', () => {
  it('finds the lines before, between and after hunks, with the old-side offset', () => {
    expect(gapsOf(rows, 41)).toEqual([
      { index: 0, start: 1, end: 7, offset: 0 },
      { index: 1, start: 13, end: 30, offset: 0 },
      { index: 2, start: 32, end: 41, offset: -1 },
    ])
  })

  it('leaves the end open until the file length is known', () => {
    expect(gapsOf(rows, null).at(-1)).toMatchObject({ start: 32, end: null })
  })
})

describe('expandGap', () => {
  it('reveals a step above the next hunk or below the previous one', () => {
    expect(expandGap(undefined, 'up', 100)).toEqual({ top: 0, bottom: EXPAND_STEP })
    expect(expandGap({ top: 0, bottom: 20 }, 'down', 80)).toEqual({ top: EXPAND_STEP, bottom: 20 })
  })

  it('never reveals more than is hidden, and "all" opens the rest', () => {
    expect(expandGap(undefined, 'up', 5)).toEqual({ top: 0, bottom: 5 })
    expect(expandGap({ top: 3, bottom: 2 }, 'all', 9)).toEqual({ top: 12, bottom: 2 })
  })
})

describe('expandRows', () => {
  const file41 = [...file.slice(0, 30), '31 new', ...file.slice(30)]

  it('marks every separator with what it hides before the file is loaded', () => {
    const out = expandRows(rows, null, new Map())
    expect(out.filter((r) => r.kind === 'hunk').map((r) => r.kind === 'hunk' && r.gap)).toEqual([
      { index: 0, hidden: 7, first: true, last: false },
      { index: 1, hidden: 18, first: false, last: false },
      { index: 2, hidden: null, first: false, last: true },
    ])
  })

  it('fills revealed lines from the file, numbered on both sides and not commentable', () => {
    const shown = new Map<number, GapShown>([
      [1, { top: 2, bottom: 3 }],
      [2, { top: 2, bottom: 0 }],
    ])
    const out = expandRows(rows, file41, shown)
    expect(newNos(out)).toEqual(['@7', 8, 9, null, 10, 11, 12, 13, 14, '@13', 28, 29, 30, 31, 32, 33, '@8'])
    const thirteen = out.find((r) => r.kind === 'ctx' && r.newNo === 13)
    expect(thirteen).toEqual({ kind: 'ctx', text: '13', oldNo: 13, newNo: 13, expanded: true })
    const afterInsert = out.find((r) => r.kind === 'ctx' && r.newNo === 32)
    expect(afterInsert).toMatchObject({ text: '31', oldNo: 31 })
  })

  it('drops a separator once its gap is fully open, and keeps a header with nothing before it', () => {
    const shown = new Map<number, GapShown>([
      [0, { top: 0, bottom: 7 }],
      [2, { top: 9, bottom: 0 }],
    ])
    const out = expandRows(rows, file41, shown)
    expect(out[0]).toMatchObject({ kind: 'ctx', newNo: 1 })
    expect(hiddenIn(gapsOf(rows, 41)[2]!, shown.get(2))).toBe(1)
    expect(out.at(-1)).toMatchObject({ kind: 'hunk', gap: { index: 2, hidden: 1 } })

    const fromTop = expandRows(parsePatch('@@ -1,2 +1,2 @@\n-a\n+b\n 2'), ['b', '2'], new Map())
    expect(fromTop[0]).toEqual({ kind: 'hunk', text: '@@ -1,2 +1,2 @@', oldStart: 1, newStart: 1 })
    expect(fromTop).toHaveLength(4)
  })
})
