import type { LogQuery } from '@shared/git-log.types.ts'
import { describe, expect, it } from 'vitest'
import {
  buildLogArgs,
  extractFilePatch,
  looksLikeHash,
  parseBranches,
  parseCommitChecks,
  parseCommitDetail,
  parseLog,
  parseNameStatus,
  readCiState,
} from './git-log.util.ts'

const ALL: LogQuery = { branch: '', text: '', author: '', sinceDays: 0, path: '', skip: 0 }

describe('buildLogArgs', () => {
  it('reads every branch by default, one page plus one to tell whether more follow', () => {
    const args = buildLogArgs(ALL, 100)
    expect(args).toContain('--max-count=101')
    expect(args).toContain('--skip=0')
    expect(args.at(-1)).toBe('--all')
  })

  it('adds the filters, with the path after "--" and the branch after --end-of-options', () => {
    const args = buildLogArgs(
      { branch: 'main', text: 'fix login', author: 'Ana', sinceDays: 7, path: 'src/app.ts', skip: 100 },
      50,
    )
    expect(args).toEqual(
      expect.arrayContaining([
        '--grep=fix login',
        '--author=Ana',
        '--since=7.days.ago',
        '--regexp-ignore-case',
        '--fixed-strings',
        '--skip=100',
      ]),
    )
    expect(args.slice(-4)).toEqual(['--end-of-options', 'main', '--', 'src/app.ts'])
  })

  it('rewrites parents, so a path filter keeps the graph connected', () => {
    expect(buildLogArgs({ ...ALL, path: 'src/app.ts' }, 10)).toContain('--parents')
  })

  it('does not grep for a hash: that is matched against the commits', () => {
    expect(buildLogArgs({ ...ALL, text: 'a1b2c3d' }, 10).some((argument) => argument.startsWith('--grep'))).toBe(false)
    expect(looksLikeHash('a1b2c3d')).toBe(true)
    expect(looksLikeHash('fix it')).toBe(false)
  })
})

describe('parseLog', () => {
  it('reads each field and the refs, without HEAD', () => {
    const output = [
      [
        'h2',
        'h1 h0',
        'Ana',
        'ana@x.dev',
        '2026-11-20T10:00:00+01:00',
        'Merge: tidy',
        'HEAD -> main, origin/main, tag: v1',
      ],
      ['h1', '', 'Bo', 'bo@x.dev', '2026-11-19T10:00:00+01:00', 'First', ''],
    ]
      .map((fields) => `${fields.join('\u001f')}\u001e`)
      .join('\n')
    expect(parseLog(output)).toEqual([
      {
        hash: 'h2',
        parents: ['h1', 'h0'],
        author: 'Ana',
        authorEmail: 'ana@x.dev',
        date: '2026-11-20T10:00:00+01:00',
        subject: 'Merge: tidy',
        refs: ['main', 'origin/main', 'tag: v1'],
      },
      {
        hash: 'h1',
        parents: [],
        author: 'Bo',
        authorEmail: 'bo@x.dev',
        date: '2026-11-19T10:00:00+01:00',
        subject: 'First',
        refs: [],
      },
    ])
  })
})

describe('parseBranches', () => {
  it('reads local branches with tracking and remote ones, skipping origin/HEAD', () => {
    const output = [
      'refs/heads/main\t*\t[ahead 2, behind 1]',
      'refs/heads/feat/x\t \t',
      'refs/remotes/origin/HEAD\t \t',
      'refs/remotes/origin/main\t \t',
    ].join('\n')
    expect(parseBranches(output)).toEqual([
      { name: 'main', kind: 'local', current: true, ahead: 2, behind: 1 },
      { name: 'feat/x', kind: 'local', current: false, ahead: 0, behind: 0 },
      { name: 'origin/main', kind: 'remote', current: false, ahead: 0, behind: 0 },
    ])
  })
})

describe('parseNameStatus', () => {
  it('reads changes, with the old path of renames', () => {
    expect(parseNameStatus(['M\tsrc/a.ts', 'R087\told.ts\tnew.ts', 'A\tb.ts', ''])).toEqual([
      { status: 'M', path: 'src/a.ts' },
      { status: 'R', path: 'new.ts', from: 'old.ts' },
      { status: 'A', path: 'b.ts' },
    ])
  })
})

describe('parseCommitDetail', () => {
  it('reads the header fields, the whole message and the changed files', () => {
    const header = ['Ana', 'ana@x.dev', '2026-11-20T10:00:00+01:00', 'GitHub', 'Fix login\n\nLonger text\n']
    const output = [header.join('\u001f'), '\nM\tsrc/a.ts\n'].join('\u001e')
    expect(parseCommitDetail('abc123', output)).toEqual({
      hash: 'abc123',
      message: 'Fix login\n\nLonger text',
      author: 'Ana',
      authorEmail: 'ana@x.dev',
      date: '2026-11-20T10:00:00+01:00',
      committer: 'GitHub',
      files: [{ status: 'M', path: 'src/a.ts' }],
    })
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

describe('extractFilePatch', () => {
  it('keeps the patch from its first hunk, dropping the diff header', () => {
    const output = 'diff --git a/x.ts b/x.ts\nindex 1..2 100644\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n'
    expect(extractFilePatch(output)).toBe('@@ -1 +1 @@\n-old\n+new')
  })

  it('is empty for a binary file, which has no hunks', () => {
    expect(extractFilePatch('diff --git a/i.png b/i.png\nBinary files differ\n')).toBe('')
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
