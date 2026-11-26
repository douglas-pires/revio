import type { Octokit } from '@octokit/rest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryWithRetry } from './graphql-retry.util.ts'

const failing = (status: number) => Object.assign(new Error('<html>…</html>'), { status })

describe('queryWithRetry', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks again once when GitHub fails on its side', async () => {
    vi.useFakeTimers()
    const graphql = vi.fn().mockRejectedValueOnce(failing(502)).mockResolvedValueOnce({ ok: true })
    const answer = queryWithRetry({ graphql } as unknown as Octokit, 'query {}')
    await vi.runAllTimersAsync()
    expect(await answer).toEqual({ ok: true })
  })

  it('says so plainly when it fails twice, and passes other errors through', async () => {
    vi.useFakeTimers()
    const twice = vi.fn().mockRejectedValue(failing(504))
    const answer = queryWithRetry({ graphql: twice } as unknown as Octokit, 'query {}')
    const checked = expect(answer).rejects.toThrow('GitHub took too long to answer')
    await vi.runAllTimersAsync()
    await checked
    const denied = vi.fn().mockRejectedValue(failing(401))
    await expect(queryWithRetry({ graphql: denied } as unknown as Octokit, 'query {}')).rejects.toThrow('<html>')
    expect(denied).toHaveBeenCalledTimes(1)
  })
})
