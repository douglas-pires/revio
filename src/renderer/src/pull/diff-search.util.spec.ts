import { describe, expect, it } from 'vitest'
import { parsePatch } from './diff.util.ts'
import { MAX_MATCHES, occurrences, searchDiffs, stepMatch } from './diff-search.util.ts'

const insensitive = { caseSensitive: false }

describe('occurrences', () => {
  it('finds every non-overlapping occurrence, ignoring case unless asked', () => {
    expect(occurrences('Foo foo FOO', 'foo', insensitive)).toEqual([0, 4, 8])
    expect(occurrences('Foo foo FOO', 'foo', { caseSensitive: true })).toEqual([4])
    expect(occurrences('aaaa', 'aa', insensitive)).toEqual([0, 2])
    expect(occurrences('abc', '', insensitive)).toEqual([])
  })
})

describe('searchDiffs', () => {
  const firstFile = { path: 'a.ts', rows: parsePatch('@@ -1,3 +1,3 @@ const x\n const x = 1\n-x = 2\n+x = x + 3') }
  const secondFile = { path: 'b.ts', rows: parsePatch('@@ -5,1 +5,1 @@\n-nothing\n+here x') }

  it('lists matches in file and line order, by new line for kept and added lines and old line for removed ones', () => {
    expect(searchDiffs([firstFile, secondFile], 'x', insensitive)).toEqual([
      { path: 'a.ts', side: 'RIGHT', line: 1, nth: 0 },
      { path: 'a.ts', side: 'LEFT', line: 2, nth: 0 },
      { path: 'a.ts', side: 'RIGHT', line: 2, nth: 0 },
      { path: 'a.ts', side: 'RIGHT', line: 2, nth: 1 },
      { path: 'b.ts', side: 'RIGHT', line: 5, nth: 0 },
    ])
  })

  it('skips hunk headers and stops at the cap', () => {
    expect(searchDiffs([firstFile], 'const', insensitive)).toHaveLength(1)
    const big = { path: 'big', rows: parsePatch(`@@ -1,1 +1,1 @@\n+${'x'.repeat(MAX_MATCHES + 5)}`) }
    expect(searchDiffs([big], 'x', insensitive)).toHaveLength(MAX_MATCHES)
  })
})

describe('stepMatch', () => {
  it('starts at the first or last match and wraps around', () => {
    expect(stepMatch(null, 3, 1)).toBe(0)
    expect(stepMatch(null, 3, -1)).toBe(2)
    expect(stepMatch(2, 3, 1)).toBe(0)
    expect(stepMatch(0, 3, -1)).toBe(2)
    expect(stepMatch(1, 0, 1)).toBeNull()
  })
})
