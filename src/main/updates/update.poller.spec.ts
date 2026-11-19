import { describe, expect, it, vi } from 'vitest'
import { UpdatePoller } from './update.poller.ts'

const release = (version: string) => ({
  version,
  releaseUrl: `https://x/v${version}`,
  downloadUrl: `https://x/${version}.dmg`,
  notes: '- fix',
})

describe('UpdatePoller', () => {
  it('reports a newer release as available', async () => {
    const onStatus = vi.fn()
    const poller = new UpdatePoller({
      current: '0.1.3',
      sourceName: 'o/r',
      loadLatest: async () => release('0.1.7'),
      onStatus,
    })
    const status = await poller.check()
    expect(status).toMatchObject({
      available: true,
      latest: '0.1.7',
      downloadUrl: 'https://x/0.1.7.dmg',
      checking: false,
      error: null,
    })
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ checking: true }))
  })

  it('is up to date on the same or an older release', async () => {
    const poller = new UpdatePoller({
      current: '0.1.7',
      sourceName: 'o/r',
      loadLatest: async () => release('0.1.7'),
      onStatus: () => undefined,
    })
    expect((await poller.check()).available).toBe(false)
  })

  it('explains when there is no release or it fails, and shares a running check', async () => {
    const none = new UpdatePoller({
      current: '0.1.0',
      sourceName: 'o/r',
      loadLatest: async () => null,
      onStatus: () => undefined,
    })
    expect((await none.check()).error).toContain('No releases found in o/r')
    const load = vi.fn(async () => Promise.reject(new Error('Bad credentials')))
    const failing = new UpdatePoller({
      current: '0.1.0',
      sourceName: 'o/r',
      loadLatest: load,
      onStatus: () => undefined,
    })
    const [a] = await Promise.all([failing.check(), failing.check()])
    expect(a).toMatchObject({ error: 'Bad credentials', checking: false })
    expect(load).toHaveBeenCalledTimes(1)
  })
})
