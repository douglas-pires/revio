import { describe, expect, it } from 'vitest'
import {
  assertCommitHash,
  buildCommitFilters,
  buildSinceDate,
  convertCommit,
  convertCommitDetail,
  type GithubCommit,
  parseCommitChecks,
  readCiState,
} from './git-log.util.ts'

const githubCommit = (over: Partial<GithubCommit> = {}): GithubCommit => ({
  sha: 'c1',
  parents: [{ sha: 'b1' }, { sha: 'f1' }],
  author: { login: 'ana' },
  commit: {
    message: 'Fix login\n\nThe token expired too early.',
    author: { name: 'Ana Lima', email: 'ana@example.com', date: '2026-01-02T03:04:05Z' },
    committer: { name: 'GitHub', date: '2026-01-02T03:05:00Z' },
  },
  ...over,
})

describe('convertCommit', () => {
  it('reads the hash, parents, GitHub login, email, date and subject', () => {
    expect(convertCommit(githubCommit())).toEqual({
      hash: 'c1',
      parents: ['b1', 'f1'],
      author: 'ana',
      authorEmail: 'ana@example.com',
      date: '2026-01-02T03:04:05Z',
      subject: 'Fix login',
      refs: [],
    })
  })

  it('falls back to the name in the commit when GitHub links no account', () => {
    expect(convertCommit(githubCommit({ author: null })).author).toBe('Ana Lima')
  })
})

describe('convertCommitDetail', () => {
  it('keeps the whole message and maps GitHub file statuses to change letters', () => {
    const detail = convertCommitDetail(
      githubCommit({
        files: [
          { filename: 'a.ts', status: 'added' },
          { filename: 'b.ts', status: 'modified' },
          { filename: 'c.ts', status: 'removed' },
          { filename: 'd.ts', status: 'renamed', previous_filename: 'old-d.ts' },
        ],
      }),
    )
    expect(detail.message).toBe('Fix login\n\nThe token expired too early.')
    expect(detail.committer).toBe('GitHub')
    expect(detail.files).toEqual([
      { status: 'A', path: 'a.ts', from: undefined },
      { status: 'M', path: 'b.ts', from: undefined },
      { status: 'D', path: 'c.ts', from: undefined },
      { status: 'R', path: 'd.ts', from: 'old-d.ts' },
    ])
  })
})

describe('buildSinceDate', () => {
  it('is the date that many days back, or none for any time', () => {
    const now = new Date('2026-01-08T00:00:00Z')
    expect(buildSinceDate(7, now)).toBe('2026-01-01T00:00:00.000Z')
    expect(buildSinceDate(0, now)).toBeUndefined()
  })
})

describe('buildCommitFilters', () => {
  it('passes only the filters that are set', () => {
    const now = new Date('2026-01-08T00:00:00Z')
    expect(buildCommitFilters({ path: ' src/a.ts ', author: '', sinceDays: 0 }, now)).toEqual({ path: 'src/a.ts' })
    expect(buildCommitFilters({ path: '', author: 'ana', sinceDays: 7 }, now)).toEqual({
      author: 'ana',
      since: '2026-01-01T00:00:00.000Z',
    })
  })
})

describe('commit hashes', () => {
  it('refuses anything that is not a hash before it reaches a GitHub query', () => {
    expect(() => assertCommitHash('a1b2c3d')).not.toThrow()
    expect(() => assertCommitHash('") { evil }')).toThrow()
  })
})

describe('readCiState', () => {
  it('maps GitHub rollup states', () => {
    expect(readCiState('SUCCESS')).toBe('success')
    expect(readCiState('ERROR')).toBe('failure')
    expect(readCiState('EXPECTED')).toBe('pending')
    expect(readCiState(null)).toBe('none')
  })
})

describe('parseCommitChecks', () => {
  it('reads check runs and statuses, failing first, then running, then passed', () => {
    const checks = parseCommitChecks([
      {
        __typename: 'CheckRun',
        name: 'lint',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        detailsUrl: 'https://ci/lint',
      },
      { __typename: 'CheckRun', name: 'build', status: 'IN_PROGRESS', conclusion: null, detailsUrl: null },
      { __typename: 'StatusContext', context: 'deploy', state: 'FAILURE', targetUrl: 'https://ci/deploy' },
      { __typename: 'CheckRun', name: 'docs', status: 'COMPLETED', conclusion: 'SKIPPED', detailsUrl: null },
      null,
    ])
    expect(checks).toEqual([
      { name: 'deploy', state: 'failure', url: 'https://ci/deploy' },
      { name: 'build', state: 'pending', url: null },
      { name: 'docs', state: 'success', url: null },
      { name: 'lint', state: 'success', url: 'https://ci/lint' },
    ])
  })
})
