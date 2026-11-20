import { describe, expect, it } from 'vitest'
import { formatShortcut, hasCommandModifier, type KeyPress, matchesShortcut, shortcutOf } from './shortcut.util.ts'

const press = (over: Partial<KeyPress>): KeyPress => ({
  key: 'o',
  code: 'KeyO',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
})

describe('shortcutOf', () => {
  it('writes modifiers in a fixed order before the key', () => {
    expect(shortcutOf(press({ metaKey: true }))).toBe('Cmd+O')
    expect(shortcutOf(press({ key: 'O', shiftKey: true, metaKey: true }))).toBe('Cmd+Shift+O')
    expect(shortcutOf(press({ key: 'e', code: 'KeyE' }))).toBe('E')
  })

  it('reads letters and digits from the physical key, which Option and Shift do not change', () => {
    expect(shortcutOf(press({ key: 'ø', altKey: true }))).toBe('Alt+O')
    expect(shortcutOf(press({ key: '!', code: 'Digit1', shiftKey: true }))).toBe('Shift+1')
  })

  it('keeps named keys as they are', () => {
    expect(shortcutOf(press({ key: 'Enter', code: 'Enter', metaKey: true }))).toBe('Cmd+Enter')
  })

  it('is not a shortcut until a key other than a modifier is down', () => {
    expect(shortcutOf(press({ key: 'Meta', code: 'MetaLeft', metaKey: true }))).toBeNull()
  })
})

describe('matchesShortcut', () => {
  it('matches the exact combination only', () => {
    expect(matchesShortcut(press({ metaKey: true }), 'Cmd+O')).toBe(true)
    expect(matchesShortcut(press({ metaKey: true, shiftKey: true }), 'Cmd+O')).toBe(false)
    expect(matchesShortcut(press({}), 'Cmd+O')).toBe(false)
  })

  it('never matches when turned off', () => {
    expect(matchesShortcut(press({ metaKey: true }), '')).toBe(false)
  })
})

describe('hasCommandModifier', () => {
  it('is true for Cmd, Ctrl or Alt combinations', () => {
    expect(hasCommandModifier('Cmd+O')).toBe(true)
    expect(hasCommandModifier('Alt+E')).toBe(true)
    expect(hasCommandModifier('Shift+E')).toBe(false)
    expect(hasCommandModifier('E')).toBe(false)
  })
})

describe('formatShortcut', () => {
  it('uses the macOS symbols', () => {
    expect(formatShortcut('Cmd+Shift+O')).toBe('⌘⇧O')
    expect(formatShortcut('Alt+Enter')).toBe('⌥↩')
    expect(formatShortcut('Cmd++')).toBe('⌘+')
    expect(formatShortcut('')).toBe('')
  })
})
