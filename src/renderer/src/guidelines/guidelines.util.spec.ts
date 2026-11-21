import type { Guideline } from '@shared/guideline.types.ts'
import { describe, expect, it } from 'vitest'
import { defaultTitle, groupGuides, newDraft } from './guidelines.util.ts'

const guide = (repo: string, path: string): Guideline => ({
  ...newDraft(repo, path),
  id: `${repo}${path}`,
  updatedAt: '',
})

describe('defaultTitle', () => {
  it('names a guide after its scope', () => {
    expect(defaultTitle(newDraft('*'))).toBe('Global')
    expect(defaultTitle(newDraft('acme/web', 'apps/api/'))).toBe('apps/api')
    expect(defaultTitle(newDraft('acme/web'))).toBe('web')
  })
})

describe('groupGuides', () => {
  it('puts all repositories first, then repositories by name, folders in order', () => {
    const groups = groupGuides([guide('b/b', 'x/'), guide('*', ''), guide('a/a', ''), guide('b/b', '')])
    expect(groups.map(([name, gs]) => [name, gs.map((guideline) => guideline.path)])).toEqual([
      ['All repositories', ['']],
      ['a/a', ['']],
      ['b/b', ['', 'x/']],
    ])
  })
})
