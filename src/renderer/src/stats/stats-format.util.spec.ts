import { describe, expect, it } from 'vitest'
import { formatSpan, formatWeek } from './stats-format.util.ts'

describe('formatSpan', () => {
  it('reads as minutes, hours or days', () => {
    expect(formatSpan(null)).toBe('–')
    expect(formatSpan(20 * 60_000)).toBe('20m')
    expect(formatSpan(6 * 3_600_000)).toBe('6h')
    expect(formatSpan(84 * 3_600_000)).toBe('3.5d')
  })
})

describe('formatWeek', () => {
  it('names the Monday', () => {
    expect(formatWeek('2026-11-02')).toBe('Nov 2')
  })
})
