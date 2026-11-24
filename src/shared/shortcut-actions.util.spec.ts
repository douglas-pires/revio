import { describe, expect, it } from 'vitest'
import {
  findActionConflict,
  moveFormerShortcuts,
  overrideShortcut,
  resolveShortcuts,
  SHORTCUT_ACTIONS,
} from './shortcut-actions.util.ts'

describe('the default shortcuts', () => {
  it('never clash with each other or with macOS', () => {
    const shortcuts = resolveShortcuts({})
    const conflicts = SHORTCUT_ACTIONS.map(({ id }) => findActionConflict(id, shortcuts[id], shortcuts))
    expect(conflicts.filter(Boolean)).toEqual([])
  })
})

describe('resolveShortcuts', () => {
  it('uses your keys where you chose some, including none at all', () => {
    const shortcuts = resolveShortcuts({ find: 'Cmd+E', 'next-file': '' })
    expect(shortcuts.find).toBe('Cmd+E')
    expect(shortcuts['next-file']).toBe('')
    expect(shortcuts['previous-file']).toBe('K')
  })
})

describe('overrideShortcut', () => {
  it('stores your keys, and forgets them when they are the default again', () => {
    const overrides = overrideShortcut({ search: 'S' }, 'find', 'Cmd+E')
    expect(overrides).toEqual({ search: 'S', find: 'Cmd+E' })
    expect(overrideShortcut(overrides, 'find', 'Cmd+F')).toEqual({ search: 'S' })
  })
})

describe('findActionConflict', () => {
  it('names the other action, or the macOS shortcut, and never the action itself', () => {
    const shortcuts = resolveShortcuts({})
    expect(findActionConflict('git-log', 'Cmd+F', shortcuts)).toBe('Find in the changed files')
    expect(findActionConflict('git-log', 'Cmd+Q', shortcuts)).toBe('Quit Revio')
    expect(findActionConflict('find', 'Cmd+F', shortcuts)).toBeNull()
  })

  it('frees the keys of an action you moved', () => {
    expect(findActionConflict('git-log', 'Cmd+F', resolveShortcuts({ find: 'Cmd+E' }))).toBeNull()
  })
})

describe('moveFormerShortcuts', () => {
  it('keeps the keys set before every shortcut could be changed', () => {
    const settings = { editor: 'zed', openInEditorShortcut: 'Cmd+Shift+E', gitLogShortcut: 'Ctrl+G' }
    expect(moveFormerShortcuts(settings)).toEqual({ editor: 'zed', shortcuts: { 'open-in-editor': 'Cmd+Shift+E' } })
  })

  it('leaves newer settings as they are', () => {
    expect(moveFormerShortcuts({ shortcuts: { find: 'Cmd+E' } })).toEqual({ shortcuts: { find: 'Cmd+E' } })
  })
})
