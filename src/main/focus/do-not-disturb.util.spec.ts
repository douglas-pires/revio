import { describe, expect, it } from 'vitest'
import { parseShortcutList, pickShortcutToRun } from './do-not-disturb.util.ts'

const BOTH = { dndOnShortcut: 'Focus on', dndOffShortcut: 'Focus off' }

describe('parseShortcutList', () => {
  it('reads one name per line, skipping blank lines', () => {
    expect(parseShortcutList('Focus on\n  Focus off \n\n')).toEqual(['Focus on', 'Focus off'])
  })
})

describe('pickShortcutToRun', () => {
  it('runs the on shortcut when a block starts', () => {
    expect(pickShortcutToRun(true, false, BOTH)).toBe('Focus on')
  })

  it('runs the off shortcut only after Revio turned it on', () => {
    expect(pickShortcutToRun(false, true, BOTH)).toBe('Focus off')
    expect(pickShortcutToRun(false, false, BOTH)).toBeNull()
  })

  it('runs nothing when it already matches', () => {
    expect(pickShortcutToRun(true, true, BOTH)).toBeNull()
  })

  it('runs nothing when no shortcut is chosen', () => {
    expect(pickShortcutToRun(true, false, { dndOnShortcut: '', dndOffShortcut: '' })).toBeNull()
  })
})
