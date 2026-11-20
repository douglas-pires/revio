import { describe, expect, it } from 'vitest'
import { isNearBottom } from './use-stick-to-bottom.hook.ts'

describe('isNearBottom', () => {
  it('is true at the bottom and within a wheel tick or two of it', () => {
    expect(isNearBottom({ scrollHeight: 2000, clientHeight: 600, scrollTop: 1400 })).toBe(true)
    expect(isNearBottom({ scrollHeight: 2000, clientHeight: 600, scrollTop: 1360 })).toBe(true)
  })

  it('is false once you have scrolled up to read', () => {
    expect(isNearBottom({ scrollHeight: 2000, clientHeight: 600, scrollTop: 1300 })).toBe(false)
    expect(isNearBottom({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })).toBe(false)
  })

  it('is true when everything fits', () => {
    expect(isNearBottom({ scrollHeight: 400, clientHeight: 600, scrollTop: 0 })).toBe(true)
  })
})
