import type { KeyPress } from '@shared/shortcut.util.ts'
import { describe, expect, it } from 'vitest'
import { interpretRecorderKey } from './shortcut-recorder.util.ts'

const press = (key: string, over: Partial<KeyPress> = {}): KeyPress => ({
  key,
  code: key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
})

describe('interpretRecorderKey', () => {
  it('records keys, waiting while only a modifier is down', () => {
    expect(interpretRecorderKey(press('k', { code: 'KeyK' }))).toEqual({ kind: 'set', shortcut: 'K' })
    expect(interpretRecorderKey(press('Meta', { metaKey: true }))).toEqual({ kind: 'wait' })
  })

  it('saves, cancels, turns off and moves on with keys pressed alone', () => {
    expect(interpretRecorderKey(press('Enter'))).toEqual({ kind: 'save' })
    expect(interpretRecorderKey(press('Escape'))).toEqual({ kind: 'cancel' })
    expect(interpretRecorderKey(press('Backspace'))).toEqual({ kind: 'set', shortcut: '' })
    expect(interpretRecorderKey(press('Tab', { shiftKey: true }))).toEqual({ kind: 'leave' })
  })

  it('records those keys with a modifier', () => {
    expect(interpretRecorderKey(press('Enter', { metaKey: true }))).toEqual({ kind: 'set', shortcut: 'Cmd+Enter' })
  })
})
