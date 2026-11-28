import { describe, expect, it } from 'vitest'
import { orderFocusShortcutsFirst } from './shortcut-order.util.ts'

describe('orderFocusShortcutsFirst', () => {
  it('lists Focus and Do Not Disturb shortcuts first, keeping each group in order', () => {
    expect(
      orderFocusShortcutsFirst(['Copy URL', 'Revio DND off', 'Take a Break', 'Work Focus', 'Do Not Disturb']),
    ).toEqual(['Revio DND off', 'Work Focus', 'Do Not Disturb', 'Copy URL', 'Take a Break'])
  })

  it('keeps the order when none look like Focus', () => {
    expect(orderFocusShortcutsFirst(['B', 'A'])).toEqual(['B', 'A'])
  })
})
