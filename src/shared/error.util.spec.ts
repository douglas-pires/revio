import { describe, expect, it } from 'vitest'
import { errorMessage } from './error.util.ts'

describe('errorMessage', () => {
  it('reads an Error’s message and stringifies anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage(42)).toBe('42')
  })
})
