import type { Branch } from '@shared/git-log.types.ts'
import { describe, expect, it } from 'vitest'
import { buildBranchTree, filterBranches, readLeafName } from './branch-tree.util.ts'

const makeBranch = (name: string): Branch => ({ name, kind: 'local', current: false, ahead: 0, behind: 0 })

describe('buildBranchTree', () => {
  it('nests branches by the folders in their names, folders first and sorted', () => {
    const tree = buildBranchTree([
      makeBranch('main'),
      makeBranch('douglas/b'),
      makeBranch('douglas/a'),
      makeBranch('codex/x/y'),
      makeBranch('backup'),
    ])
    expect(tree.branches.map((match) => match.name)).toEqual(['backup', 'main'])
    expect(tree.folders.map((folder) => folder.path)).toEqual(['codex', 'douglas'])
    expect(tree.folders[1]?.branches.map((match) => match.name)).toEqual(['douglas/a', 'douglas/b'])
    expect(tree.folders[0]?.folders[0]?.path).toBe('codex/x')
    expect(tree.folders[0]?.folders[0]?.branches.map((match) => readLeafName(match.name))).toEqual(['y'])
  })
})

describe('filterBranches', () => {
  it('matches any part of the name, ignoring case', () => {
    expect(filterBranches([makeBranch('main'), makeBranch('douglas/PED-1')], 'ped').map((match) => match.name)).toEqual(
      ['douglas/PED-1'],
    )
    expect(filterBranches([makeBranch('main')], ' ')).toHaveLength(1)
  })
})
