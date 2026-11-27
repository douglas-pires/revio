import { describe, expect, it } from 'vitest'
import { readSelectedName, readWordAt } from './symbol-word.util.ts'

describe('readWordAt', () => {
  const line = 'const total = sumItems(cart.items, $rate)'
  it.each([
    [8, 'total'],
    [16, 'sumItems'],
    [26, 'cart'],
    [36, '$rate'],
    [12, null],
  ])('offset %i → %s', (offset, expected) => expect(readWordAt(line, offset)).toBe(expected))

  it('skips one-letter names and numbers', () => {
    expect(readWordAt('x = 42', 0)).toBeNull()
    expect(readWordAt('x = 42', 5)).toBeNull()
  })
})

describe('readSelectedName', () => {
  it('takes one identifier, not a phrase', () => {
    expect(readSelectedName(' chargeCard ')).toBe('chargeCard')
    expect(readSelectedName('charge card')).toBeNull()
  })
})
