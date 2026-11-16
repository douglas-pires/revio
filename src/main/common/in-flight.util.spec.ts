import { describe, expect, it, vi } from 'vitest'
import { InFlight } from './in-flight.util'

describe('InFlight', () => {
  it('shares a running job per key and starts a new one once it settles', async () => {
    const shared = new InFlight<number>()
    const job = vi.fn(async () => 1)
    const [a, b] = await Promise.all([shared.run('k', job), shared.run('k', job)])
    expect([a, b, job.mock.calls.length]).toEqual([1, 1, 1])
    await shared.run('k', job)
    expect(job).toHaveBeenCalledTimes(2)
  })

  it('keeps keys apart and lets a failed job be retried', async () => {
    const shared = new InFlight<string>()
    await expect(shared.run('a', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(Promise.all([shared.run('a', async () => 'x'), shared.run('b', async () => 'y')])).resolves.toEqual(['x', 'y'])
  })
})
