import { describe, expect, it } from 'vitest'
import {
  buildShortcutPlist,
  findMissingShortcuts,
  parseShortcutList,
  pickShortcutToRun,
  REVIO_SHORTCUTS,
} from './do-not-disturb.util.ts'

describe('parseShortcutList', () => {
  it('reads one name per line, skipping blank lines', () => {
    expect(parseShortcutList('Copy URL\n  Take a Break \n\n')).toEqual(['Copy URL', 'Take a Break'])
  })
})

describe('findMissingShortcuts', () => {
  it('names the shortcuts Revio still needs', () => {
    expect(findMissingShortcuts(['Copy URL', REVIO_SHORTCUTS.on])).toEqual([REVIO_SHORTCUTS.off])
    expect(findMissingShortcuts([REVIO_SHORTCUTS.off, REVIO_SHORTCUTS.on])).toEqual([])
  })
})

describe('pickShortcutToRun', () => {
  it('turns it on when a block starts with the switch on', () => {
    expect(pickShortcutToRun(true, false, true)).toBe(REVIO_SHORTCUTS.on)
  })

  it('does nothing when the switch is off', () => {
    expect(pickShortcutToRun(true, false, false)).toBeNull()
  })

  it('turns it off only after Revio turned it on, even if the switch went off since', () => {
    expect(pickShortcutToRun(false, true, false)).toBe(REVIO_SHORTCUTS.off)
    expect(pickShortcutToRun(false, false, true)).toBeNull()
  })

  it('does nothing when it already matches', () => {
    expect(pickShortcutToRun(true, true, true)).toBeNull()
  })
})

describe('buildShortcutPlist', () => {
  it('sets Do Not Disturb on until turned off, or off', () => {
    expect(buildShortcutPlist(true)).toContain('<key>Enabled</key><integer>1</integer>')
    expect(buildShortcutPlist(false)).toContain('<key>Enabled</key><integer>0</integer>')
    expect(buildShortcutPlist(true)).toContain('com.apple.donotdisturb.mode.default')
  })
})
