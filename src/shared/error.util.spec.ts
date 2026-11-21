import { describe, expect, it } from 'vitest'
import { readErrorMessage } from './error.util.ts'

describe('errorMessage', () => {
  it('reads an Error’s message and stringifies anything else', () => {
    expect(readErrorMessage(new Error('boom'))).toBe('boom')
    expect(readErrorMessage('plain')).toBe('plain')
    expect(readErrorMessage(42)).toBe('42')
  })
})
