import { describe, expect, it } from 'vitest'
import { makeFile } from '../../../test/fixtures.ts'
import { buildSinceReview, type ComparedFile, keepChangedSinceRebase } from './since-review.util.ts'

const compared = (filename: string, patch = '@@ -1 +1 @@\n-a\n+b'): ComparedFile => ({
  filename,
  status: 'modified',
  additions: 1,
  deletions: 1,
  patch,
})

const reviewed = { sha: 'abc', at: '2026-11-01T00:00:00Z' }

describe('buildSinceReview', () => {
  const prFiles = [makeFile({ path: 'cart.ts', sha: 'pr-sha' }), makeFile({ path: 'total.ts' })]

  it('keeps the PR’s files that changed since, with the newer diff and the PR file’s sha', () => {
    const since = buildSinceReview(
      prFiles,
      { status: 'ahead', commitParents: [1], files: [compared('cart.ts', '+new'), compared('main-only.ts')] },
      reviewed,
    )
    expect(since.files.map((file) => [file.path, file.sha, file.patch])).toEqual([['cart.ts', 'pr-sha', '+new']])
    expect(since.rebased).toBe(false)
  })

  it('says when the branch was rebased or merged with its base', () => {
    expect(buildSinceReview(prFiles, { status: 'diverged', commitParents: [], files: [] }, reviewed).rebased).toBe(true)
    expect(buildSinceReview(prFiles, { status: 'ahead', commitParents: [1, 2], files: [] }, reviewed).rebased).toBe(
      true,
    )
  })
})

describe('keepChangedSinceRebase', () => {
  it('keeps only files whose own changes differ from what you reviewed, whatever the line numbers', () => {
    const prFiles = [
      makeFile({ path: 'moved.ts', patch: '@@ -40,1 +41,1 @@\n-a\n+b' }),
      makeFile({ path: 'edited.ts', patch: '@@ -1 +1 @@\n-a\n+c' }),
    ]
    const since = buildSinceReview(
      prFiles,
      { status: 'diverged', commitParents: [], files: [compared('moved.ts'), compared('edited.ts')] },
      reviewed,
    )
    const reviewedFiles = [
      compared('moved.ts', '@@ -10,1 +10,1 @@\n-a\n+b'),
      compared('edited.ts', '@@ -1 +1 @@\n-a\n+b'),
    ]
    expect(keepChangedSinceRebase(since, prFiles, reviewedFiles).files.map((file) => file.path)).toEqual(['edited.ts'])
  })
})
