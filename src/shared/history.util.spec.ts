import { describe, expect, it } from 'vitest'
import type { BlameRange, CommitSummary } from './history.types'
import { blameAt, markPrCommits, patchOfFile } from './history.util'

const commit = (sha: string): CommitSummary => ({ sha, shortSha: sha.slice(0, 7), headline: sha, author: 'ana', authorAvatar: '', date: '', url: '' })
const range = (start: number, end: number, sha: string): BlameRange => ({ start, end, commit: commit(sha) })

describe('blameAt', () => {
  const ranges = [range(1, 3, 'a'), range(4, 4, 'b'), range(5, 20, 'c')]

  it.each([
    [1, 'a'],
    [3, 'a'],
    [4, 'b'],
    [12, 'c'],
    [20, 'c'],
  ])('finds the range for line %i', (line, sha) => expect(blameAt(ranges, line)?.commit.sha).toBe(sha))

  it('is undefined outside every range', () => {
    expect(blameAt(ranges, 21)).toBeUndefined()
    expect(blameAt([], 1)).toBeUndefined()
  })
})

describe('markPrCommits', () => {
  it('flags only the PR commits, keeping the order', () => {
    expect(markPrCommits([commit('x'), commit('y')], new Set(['y'])).map((c) => [c.sha, c.inThisPr])).toEqual([
      ['x', false],
      ['y', true],
    ])
  })
})

describe('patchOfFile', () => {
  const files = [
    { path: 'a.ts', status: 'modified', additions: 1, deletions: 0, patch: '@@ a' },
    { path: 'new.ts', previousPath: 'old.ts', status: 'renamed', additions: 0, deletions: 0, patch: '@@ r' },
    { path: 'img.png', status: 'added', additions: 0, deletions: 0 },
  ]

  it('finds a file by its path or its name before a rename', () => {
    expect(patchOfFile(files, 'a.ts')).toBe('@@ a')
    expect(patchOfFile(files, 'old.ts')).toBe('@@ r')
  })

  it('is null for a file without a diff or not in the commit', () => {
    expect(patchOfFile(files, 'img.png')).toBeNull()
    expect(patchOfFile(files, 'x.ts')).toBeNull()
  })
})
