import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExpiringValue } from './expiring-value.ts'

describe('ExpiringValue', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads once while fresh, again once old or forgotten', async () => {
    vi.useFakeTimers()
    let loads = 0
    const value = new ExpiringValue(async () => ++loads, 1000)
    await Promise.all([value.get(), value.get()])
    expect(await value.get()).toBe(1)
    vi.advanceTimersByTime(1001)
    expect(await value.get()).toBe(2)
    value.forget()
    expect(await value.get()).toBe(3)
  })
})
