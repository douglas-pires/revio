import type { Branch } from '@shared/git-log.types.ts'
import { describe, expect, it } from 'vitest'
import { branchTree, filterBranches, leafName } from './branch-tree.util.ts'

const b = (name: string): Branch => ({ name, kind: 'local', current: false, ahead: 0, behind: 0 })

describe('branchTree', () => {
  it('nests branches by the folders in their names, folders first and sorted', () => {
    const tree = branchTree([b('main'), b('douglas/b'), b('douglas/a'), b('codex/x/y'), b('backup')])
    expect(tree.branches.map((x) => x.name)).toEqual(['backup', 'main'])
    expect(tree.folders.map((f) => f.path)).toEqual(['codex', 'douglas'])
    expect(tree.folders[1]?.branches.map((x) => x.name)).toEqual(['douglas/a', 'douglas/b'])
    expect(tree.folders[0]?.folders[0]?.path).toBe('codex/x')
    expect(tree.folders[0]?.folders[0]?.branches.map((x) => leafName(x.name))).toEqual(['y'])
  })
})

describe('filterBranches', () => {
  it('matches any part of the name, ignoring case', () => {
    expect(filterBranches([b('main'), b('douglas/PED-1')], 'ped').map((x) => x.name)).toEqual(['douglas/PED-1'])
    expect(filterBranches([b('main')], ' ')).toHaveLength(1)
  })
})
