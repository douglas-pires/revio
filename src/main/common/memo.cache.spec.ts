import { describe, expect, it, vi } from 'vitest'
import { MemoCache } from './memo.cache.ts'

describe('MemoCache', () => {
  it('loads a key once, sharing a load in progress', async () => {
    const cache = new MemoCache<number>()
    const load = vi.fn(async () => 7)
    expect(await Promise.all([cache.get('a', load), cache.get('a', load)])).toEqual([7, 7])
    expect(await cache.get('a', load)).toBe(7)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('forgets the oldest key past its size, and does not keep failures', async () => {
    const cache = new MemoCache<string>(1)
    await cache.get('a', async () => 'a1')
    await cache.get('b', async () => 'b1')
    expect(await cache.get('a', async () => 'a2')).toBe('a2')
    await expect(cache.get('c', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(await cache.get('c', async () => 'c1')).toBe('c1')
  })
})
