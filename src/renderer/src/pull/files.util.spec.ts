import { describe, expect, it } from 'vitest'
import { formatDuration, isGenerated } from '@/common/format.util.ts'
import { EMPTY, groupBy } from '@/common/group.util.ts'
import { collectNewSideLines, computeInitialCollapsed, groupByDir, suggestFolders } from '@/pull/files.util.ts'
import { assertPresent, makeDetail, makeFile } from '../../../../test/fixtures.ts'

describe('groupByDir', () => {
  it('groups by containing folder, root files under ""', () => {
    const out = groupByDir([{ path: 'a/x.ts' }, { path: 'README.md' }, { path: 'a/y.ts' }])
    expect(out).toEqual([
      ['a/', [{ path: 'a/x.ts' }, { path: 'a/y.ts' }]],
      ['', [{ path: 'README.md' }]],
    ])
  })
})

describe('suggestFolders', () => {
  it('goes two levels deep under monorepo roots and one level elsewhere', () => {
    expect(suggestFolders(['apps/web/src/a.ts', 'apps/api/b.ts', 'src/c.ts', 'README.md', 'apps/x.ts'])).toEqual([
      'apps/web/',
      'apps/api/',
      'src/',
      'apps/',
    ])
  })
})

describe('initialCollapsed', () => {
  it('collapses files viewed at this version, skippable per Claude, or generated', () => {
    const pr = makeDetail({
      files: [
        makeFile({ path: 'viewed.ts', sha: 'v1' }),
        makeFile({ path: 'changed-since.ts', sha: 'v2' }),
        makeFile({ path: 'skip.ts' }),
        makeFile({ path: 'package-lock.json' }),
        makeFile({ path: 'real.ts' }),
      ],
    })
    const briefing = {
      gist: '',
      intent: '',
      risk: 'low' as const,
      focus: [],
      ignore: [{ path: 'skip.ts', reason: 'rename' }],
      concerns: [],
      questions: [],
      guidelineChecks: [],
    }
    const collapsed = computeInitialCollapsed(pr, {
      drafts: [],
      viewed: { 'viewed.ts': 'v1', 'changed-since.ts': 'old' },
      briefing: { briefing, headSha: 'h', createdAt: '', backend: 'api', model: 'claude-opus-5-5', omittedFiles: [] },
    })
    expect(collapsed).toEqual({
      'viewed.ts': true,
      'changed-since.ts': false,
      'skip.ts': true,
      'package-lock.json': true,
      'real.ts': false,
    })
  })
})

// biome-ignore lint/security/noSecrets: a test name, not a secret.
describe('newSideLinesByPath', () => {
  it('lists new-side lines a comment can attach to, empty for binary files', () => {
    const pr = makeDetail({
      files: [
        makeFile({ path: 'a.ts', patch: '@@ -1,2 +1,2 @@\n x\n-y\n+z' }),
        makeFile({ path: 'img.png', patch: undefined }),
      ],
    })
    const lines = collectNewSideLines(pr)
    expect([...assertPresent(lines.get('a.ts'))]).toEqual([1, 2])
    expect(lines.get('img.png')?.size).toBe(0)
  })
})

describe('isGenerated', () => {
  it.each(['yarn.lock', 'apps/web/pnpm-lock.yaml', 'x/__snapshots__/a.test.ts.snap', 'dist/index.js', 'a.min.js'])(
    'flags %s',
    (path) => expect(isGenerated(path)).toBe(true),
  )
  it.each(['src/build.ts', 'lockfile.ts', 'distance/a.ts'])('leaves %s alone', (path) =>
    expect(isGenerated(path)).toBe(false),
  )
})

describe('duration', () => {
  it.each([
    [0, 'now'],
    [0.5, '30m'],
    [5.4, '5h'],
    [47, '47h'],
    [72, '3d'],
  ])('%d hours → %s', (hours, expected) => expect(formatDuration(hours)).toBe(expected))
})

describe('groupBy', () => {
  it('keeps insertion order', () => {
    const groups = groupBy(
      [
        { k: 'b', v: 1 },
        { k: 'a', v: 2 },
        { k: 'b', v: 3 },
      ],
      (entry) => entry.k,
    )
    expect([...groups.keys()]).toEqual(['b', 'a'])
    expect(groups.get('b')?.map((entry) => entry.v)).toEqual([1, 3])
  })

  it('shares one frozen empty array', () => {
    expect(Object.isFrozen(EMPTY)).toBe(true)
  })
})
