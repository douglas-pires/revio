import { describe, expect, it } from 'vitest'
import { rankFiles, splitMatchedPath } from './quick-open.util.ts'

const files = [
  { path: 'src/main/app/api.controller.ts' },
  { path: 'src/renderer/src/pull/pull.view.tsx' },
  { path: 'src/renderer/src/pull/diff-file.component.tsx' },
  { path: 'README.md' },
]

describe('rankFiles', () => {
  it('lists every file in diff order without a query', () => {
    expect(rankFiles(files, '  ').map((match) => match.item.path)).toEqual(files.map((file) => file.path))
  })

  it('ranks file-name matches first and drops files that do not match', () => {
    const ranked = rankFiles(files, 'pullview').map((match) => match.item.path)
    expect(ranked[0]).toBe('src/renderer/src/pull/pull.view.tsx')
    expect(ranked).not.toContain('README.md')
  })
})

describe('splitMatchedPath', () => {
  it('splits a path into folder and name, moving each matched position to its part', () => {
    expect(splitMatchedPath('src/pull/a.ts', [0, 4, 9, 10])).toEqual({
      folder: 'src/pull/',
      folderPositions: [0, 4],
      name: 'a.ts',
      namePositions: [0, 1],
    })
    expect(splitMatchedPath('README.md', [0])).toMatchObject({ folder: '', name: 'README.md', namePositions: [0] })
  })
})
