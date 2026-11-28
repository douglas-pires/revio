import { describe, expect, it } from 'vitest'
import {
  formatClock,
  isBlockOver,
  pauseBlock,
  readLeftMs,
  readStoredBlock,
  resumeBlock,
  startBlock,
} from './review-block.util.ts'

const MINUTE = 60_000

describe('review blocks', () => {
  it('counts down from the start', () => {
    const block = startBlock(45, 0)
    expect(readLeftMs(block, 10 * MINUTE)).toBe(35 * MINUTE)
    expect(isBlockOver(block, 45 * MINUTE)).toBe(true)
    expect(readLeftMs(block, 50 * MINUTE)).toBe(0)
  })

  it('stands still while paused and goes on from there', () => {
    const paused = pauseBlock(startBlock(25, 0), 5 * MINUTE)
    expect(readLeftMs(paused, 60 * MINUTE)).toBe(20 * MINUTE)
    const resumed = resumeBlock(paused, 60 * MINUTE)
    expect(readLeftMs(resumed, 70 * MINUTE)).toBe(10 * MINUTE)
  })

  it('formats what is left as a clock', () => {
    expect(formatClock(45 * MINUTE)).toBe('45:00')
    expect(formatClock(61_500)).toBe('1:02')
    expect(formatClock(90 * MINUTE)).toBe('1:30:00')
  })

  it('reads back a stored block, and nothing from junk', () => {
    const block = startBlock(60, 1000)
    expect(readStoredBlock(JSON.stringify(block))).toEqual(block)
    expect(readStoredBlock(null)).toBeNull()
    expect(readStoredBlock('{"minutes":7}')).toBeNull()
    expect(readStoredBlock('not json')).toBeNull()
  })
})
