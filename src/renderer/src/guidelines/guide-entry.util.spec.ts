import { describe, expect, it } from 'vitest'
import { buildEntryText, listGuideScopes } from './guide-entry.util.ts'

describe('buildEntryText', () => {
  it('drops suggested code, which only fits one line', () => {
    expect(buildEntryText('Name it for what it holds.\n```suggestion\nconst users = []\n```\n')).toBe(
      'Name it for what it holds.',
    )
  })
})

describe('listGuideScopes', () => {
  it('offers the file’s folder, its repository and every repository', () => {
    expect(listGuideScopes('acme/web', 'apps/web/src/app.ts').map((scope) => scope.label)).toEqual([
      'acme/web › apps/web/src/',
      'acme/web',
      'All repositories',
    ])
  })

  it('skips the folder for a file at the top of the repository', () => {
    expect(listGuideScopes('acme/web', 'README.md').map((scope) => scope.path)).toEqual(['', ''])
  })
})
