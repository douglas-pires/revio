import { describe, expect, it } from 'vitest'
import { stepResult } from './step-result.util.ts'

describe('stepResult', () => {
  it('moves through the results and wraps around', () => {
    expect(stepResult(0, 1, 3)).toBe(1)
    expect(stepResult(2, 1, 3)).toBe(0)
    expect(stepResult(0, -1, 3)).toBe(2)
    expect(stepResult(0, 1, 0)).toBe(0)
  })
})
