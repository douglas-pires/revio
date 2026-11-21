import { describe, expect, it } from 'vitest'
import type { BlameRange, CommitSummary } from './history.types.ts'
import { findBlameAt, findFilePatch, markPrCommits } from './history.util.ts'

const commit = (sha: string): CommitSummary => ({
  sha,
  shortSha: sha.slice(0, 7),
  headline: sha,
  author: 'ana',
  authorAvatar: '',
  date: '',
  url: '',
})
const makeRange = (start: number, end: number, sha: string): BlameRange => ({ start, end, commit: commit(sha) })

describe('blameAt', () => {
  const ranges = [makeRange(1, 3, 'a'), makeRange(4, 4, 'b'), makeRange(5, 20, 'c')]

  it.each([
    [1, 'a'],
    [3, 'a'],
    [4, 'b'],
    [12, 'c'],
    [20, 'c'],
  ])('finds the range for line %i', (line, sha) => expect(findBlameAt(ranges, line)?.commit.sha).toBe(sha))

  it('is undefined outside every range', () => {
    expect(findBlameAt(ranges, 21)).toBeUndefined()
    expect(findBlameAt([], 1)).toBeUndefined()
  })
})

describe('markPrCommits', () => {
  it('flags only the PR commits, keeping the order', () => {
    expect(
      markPrCommits([commit('x'), commit('y')], new Set(['y'])).map((marked) => [marked.sha, marked.inThisPr]),
    ).toEqual([
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
    expect(findFilePatch(files, 'a.ts')).toBe('@@ a')
    expect(findFilePatch(files, 'old.ts')).toBe('@@ r')
  })

  it('is null for a file without a diff or not in the commit', () => {
    expect(findFilePatch(files, 'img.png')).toBeNull()
    expect(findFilePatch(files, 'x.ts')).toBeNull()
  })
})
