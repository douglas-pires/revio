import { describe, expect, it } from 'vitest'
import { parsePatch } from './diff.util.ts'
import { buildDraftFromSelection, describeRange, findEditorLine, isInFocus } from './diff-file.util.ts'

const ROWS = parsePatch('@@ -10,2 +10,2 @@\n a\n-b\n+c')

describe('rangeLabel', () => {
  it('names one line or a range, on either side', () => {
    expect(describeRange({ side: 'RIGHT', start: 4, end: 4 })).toBe('Line 4')
    expect(describeRange({ side: 'LEFT', start: 4, end: 6 })).toBe('Old lines 4–6')
  })
})

describe('isInFocus', () => {
  it('checks the new-side line against the ranges', () => {
    expect(ROWS.map((row) => isInFocus(row, [[11, 11]]))).toEqual([false, false, false, true])
  })
})

describe('draftFromSelection', () => {
  it('leaves out the start line for a single line', () => {
    expect(buildDraftFromSelection('a.ts', { side: 'RIGHT', start: 3, end: 3 }, 'x')).toEqual({
      path: 'a.ts',
      side: 'RIGHT',
      line: 3,
      body: 'x',
    })
    expect(buildDraftFromSelection('a.ts', { side: 'LEFT', start: 2, end: 3 }, 'x')).toMatchObject({ startLine: 2 })
  })
})

describe('editorLineOf', () => {
  it('prefers the selected new-side line, then the first added line', () => {
    expect(findEditorLine({ side: 'RIGHT', start: 7, end: 9 }, ROWS)).toBe(7)
    expect(findEditorLine(null, ROWS)).toBe(11)
    expect(findEditorLine(null, [])).toBeUndefined()
  })
})
