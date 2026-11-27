import type { PullCommit } from '@shared/history.types.ts'
import { describe, expect, it } from 'vitest'
import { makeFile } from '../../../../test/fixtures.ts'
import { stepCommit, toCommitPullFiles } from './commit-step.util.ts'

describe('stepCommit', () => {
  it('goes from all commits to the first or last, then along, then back to all', () => {
    expect(stepCommit(null, 1, 3)).toBe(0)
    expect(stepCommit(null, -1, 3)).toBe(2)
    expect(stepCommit(0, 1, 3)).toBe(1)
    expect(stepCommit(2, 1, 3)).toBeNull()
    expect(stepCommit(0, -1, 3)).toBeNull()
    expect(stepCommit(null, 1, 0)).toBeNull()
  })
})

describe('toCommitPullFiles', () => {
  it('keeps the PR file’s sha where there is one, so "viewed" is shared', () => {
    const commit = { sha: 'c1', isMerge: false } as PullCommit
    const files = toCommitPullFiles(
      [
        { path: 'a.ts', status: 'modified', additions: 1, deletions: 0, patch: '+x' },
        { path: 'gone.ts', status: 'added', additions: 1, deletions: 0 },
      ],
      [makeFile({ path: 'a.ts', sha: 'pr-sha' })],
      commit,
    )
    expect(files.map((file) => [file.path, file.sha])).toEqual([
      ['a.ts', 'pr-sha'],
      ['gone.ts', 'c1'],
    ])
  })

  it('keeps only the PR’s own files from a merge commit', () => {
    const merge = { sha: 'm1', isMerge: true } as PullCommit
    const files = toCommitPullFiles(
      [
        { path: 'a.ts', status: 'modified', additions: 1, deletions: 0 },
        { path: 'from-main.ts', status: 'modified', additions: 9, deletions: 0 },
      ],
      [makeFile({ path: 'a.ts' })],
      merge,
    )
    expect(files.map((file) => file.path)).toEqual(['a.ts'])
  })
})
