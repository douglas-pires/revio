import type { Guideline } from '@shared/guideline.types.ts'
import { describe, expect, it } from 'vitest'
import { buildDefaultTitle, groupGuides, makeNewDraft } from './guidelines.util.ts'

const makeGuide = (repo: string, path: string): Guideline => ({
  ...makeNewDraft(repo, path),
  id: `${repo}${path}`,
  updatedAt: '',
})

describe('defaultTitle', () => {
  it('names a guide after its scope', () => {
    expect(buildDefaultTitle(makeNewDraft('*'))).toBe('Global')
    expect(buildDefaultTitle(makeNewDraft('acme/web', 'apps/api/'))).toBe('apps/api')
    expect(buildDefaultTitle(makeNewDraft('acme/web'))).toBe('web')
  })
})

describe('groupGuides', () => {
  it('puts all repositories first, then repositories by name, folders in order', () => {
    const groups = groupGuides([makeGuide('b/b', 'x/'), makeGuide('*', ''), makeGuide('a/a', ''), makeGuide('b/b', '')])
    expect(groups.map(([name, guidelines]) => [name, guidelines.map((guideline) => guideline.path)])).toEqual([
      ['All repositories', ['']],
      ['a/a', ['']],
      ['b/b', ['', 'x/']],
    ])
  })
})
