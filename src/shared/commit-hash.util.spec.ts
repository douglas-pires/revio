import { describe, expect, it } from 'vitest'
import { looksLikeHash } from './commit-hash.util.ts'

describe('looksLikeHash', () => {
  it('tells a hash (seven characters or more) from message text', () => {
    expect(looksLikeHash(' a1b2c3d ')).toBe(true)
    expect(looksLikeHash('a1b2c3')).toBe(false)
    expect(looksLikeHash('fix it')).toBe(false)
  })
})
