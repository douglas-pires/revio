import type { UpdateInstall } from '@shared/update.types.ts'
import { describe, expect, it, vi } from 'vitest'
import { type ReleaseInstaller, UpdateInstaller } from './update.installer.ts'

/** An installer over a stand-in for electron-updater, with every status it went through. */
function createInstaller(over: Partial<ReleaseInstaller> = {}, supported = true) {
  const changes: UpdateInstall[] = []
  let refuse: (message: string) => void = () => undefined
  const release: ReleaseInstaller = {
    download: vi.fn(async () => '0.3.0'),
    restart: vi.fn(),
    onRefused: (listener) => {
      refuse = listener
    },
    ...over,
  }
  const create = vi.fn(() => release)
  const installer = new UpdateInstaller({
    supported,
    createInstaller: create,
    onChange: (install) => changes.push(install),
  })
  return { installer, release, changes, create, refuse: (message: string) => refuse(message) }
}

describe('UpdateInstaller', () => {
  it('reports the download as it goes, then that it is ready', async () => {
    const { installer, changes } = createInstaller({
      download: async (onPercent) => {
        onPercent(40)
        return await Promise.resolve('0.3.0')
      },
    })
    await installer.download()
    expect(changes).toEqual([
      { phase: 'downloading', percent: 0 },
      { phase: 'downloading', percent: 40 },
      { phase: 'ready', version: '0.3.0' },
    ])
  })

  it('downloads once, however often it is asked', async () => {
    const { installer, release } = createInstaller()
    await Promise.all([installer.download(), installer.download()])
    await installer.download()
    expect(release.download).toHaveBeenCalledTimes(1)
  })

  it('restarts only into a downloaded update', async () => {
    const { installer, release } = createInstaller()
    installer.restart()
    expect(release.restart).not.toHaveBeenCalled()
    await installer.download()
    installer.restart()
    expect(release.restart).toHaveBeenCalledTimes(1)
  })

  it('says why a download failed, and can try again', async () => {
    const download = vi
      .fn<ReleaseInstaller['download']>()
      .mockRejectedValueOnce(new Error('sha512 checksum mismatch'))
      .mockResolvedValueOnce('0.3.0')
    const { installer } = createInstaller({ download })
    await installer.download()
    expect(installer.status).toEqual({ phase: 'failed', message: 'sha512 checksum mismatch' })
    await installer.download()
    expect(installer.status).toEqual({ phase: 'ready', version: '0.3.0' })
  })

  it('is no longer ready once macOS refuses the update', async () => {
    const { installer, release, refuse } = createInstaller()
    await installer.download()
    refuse('Code signature did not match')
    expect(installer.status).toEqual({ phase: 'failed', message: 'Code signature did not match' })
    installer.restart()
    expect(release.restart).not.toHaveBeenCalled()
  })

  it('fails when the release has nothing newer for this Mac', async () => {
    const { installer } = createInstaller({ download: async () => await Promise.resolve(null) })
    await installer.download()
    expect(installer.status.phase).toBe('failed')
  })

  it('leaves a copy that cannot replace itself alone', async () => {
    const { installer, create } = createInstaller({}, false)
    await installer.download()
    expect(installer.status).toEqual({ phase: 'unsupported' })
    expect(create).not.toHaveBeenCalled()
  })
})
