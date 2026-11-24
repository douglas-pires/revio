import { describe, expect, it } from 'vitest'
import { addPalettePage, listPaletteEntries } from './palette-pages.service.ts'

const action = (id: string) => ({ id, label: id, run: () => undefined })

describe('the palette', () => {
  it('lists the actions of the current screen, then those of everywhere, and forgets a screen you left', () => {
    addPalettePage(() => ({ name: 'Anywhere', everywhere: true, actions: [action('settings')] }))
    const leaveInbox = addPalettePage(() => ({ name: 'Inbox', actions: [action('refresh')] }))
    expect(listPaletteEntries().map(({ id, page }) => `${page}: ${id}`)).toEqual([
      'Inbox: refresh',
      'Anywhere: settings',
    ])
    leaveInbox()
    expect(listPaletteEntries().map(({ id }) => id)).toEqual(['settings'])
  })

  it('asks each screen when it is read, so the actions are the current ones', () => {
    let label = 'Show blame'
    const leave = addPalettePage(() => ({ name: 'Files', actions: [{ ...action('blame'), label }] }))
    label = 'Hide blame'
    expect(listPaletteEntries()[0]?.label).toBe('Hide blame')
    leave()
  })
})
