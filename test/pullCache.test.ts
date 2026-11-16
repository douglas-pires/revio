import { afterEach, describe, expect, it, vi } from 'vitest'
import { PullCache } from '../src/main/pullCache'
import { makeDetail } from './fixtures'

const PR = { repo: 'acme/web', number: 1 }

afterEach(() => vi.useRealTimers())

describe('PullCache', () => {
  it('shares one fetch between concurrent requests', async () => {
    const fetch = vi.fn(async () => makeDetail())
    const cache = new PullCache(fetch)
    const [a, b] = await Promise.all([cache.get(PR), cache.get(PR)])
    expect(fetch).toHaveBeenCalledOnce()
    expect(a).toBe(b)
  })

  it('serves a copy within maxAge and refetches once it is older, or when maxAge is 0', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(async () => makeDetail())
    const cache = new PullCache(fetch)
    await cache.get(PR)
    await cache.get(PR, 60_000)
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_001)
    await cache.get(PR, 60_000)
    await cache.get(PR)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('does not cache failures, so the next call retries', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(makeDetail())
    const cache = new PullCache(fetch)
    await expect(cache.get(PR, 60_000)).rejects.toThrow('boom')
    expect(cache.peek(PR)).toBeUndefined()
    await expect(cache.get(PR, 60_000)).resolves.toMatchObject({ number: 1 })
    expect(cache.peek(PR)).toBeDefined()
  })
})
