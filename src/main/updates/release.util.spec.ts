import { describe, expect, it } from 'vitest'
import { isNewerVersion, pickInstaller, releaseSourceOf } from './release.util.ts'

describe('releaseSourceOf', () => {
  it('reads the GitHub publish target', () => {
    expect(
      releaseSourceOf({ build: { publish: [{ provider: 's3' }, { provider: 'github', owner: 'o', repo: 'r' }] } }),
    ).toEqual({ owner: 'o', repo: 'r' })
    expect(releaseSourceOf({ build: { publish: { provider: 'github', owner: 'o', repo: 'r' } } })).toEqual({
      owner: 'o',
      repo: 'r',
    })
  })

  it('falls back to the GitHub repository, which is all a packaged app keeps', () => {
    expect(releaseSourceOf({ repository: { type: 'git', url: 'https://github.com/douglas-pires/revio.git' } })).toEqual(
      { owner: 'douglas-pires', repo: 'revio' },
    )
    expect(releaseSourceOf({ repository: 'git+ssh://git@github.com/o/r.git' })).toEqual({ owner: 'o', repo: 'r' })
    expect(releaseSourceOf({ repository: 'o/r' })).toEqual({ owner: 'o', repo: 'r' })
    expect(releaseSourceOf({ repository: 'https://gitlab.com/o/r.git' })).toBeNull()
  })

  it('is null without one', () => {
    expect(releaseSourceOf({})).toBeNull()
    expect(releaseSourceOf({ build: { publish: [{ provider: 'github' }] } })).toBeNull()
  })
})

describe('isNewerVersion', () => {
  it.each([
    ['0.1.12', '0.1.9', true],
    ['v0.2.0', '0.1.99', true],
    ['1.0', '0.9.9', true],
    ['0.1.9', '0.1.9', false],
    ['0.1.8', '0.1.9', false],
    ['0.1.10-beta', '0.1.10', false],
  ])('%s newer than %s: %s', (a, b, expected) => expect(isNewerVersion(a, b)).toBe(expected))
})

describe('pickInstaller', () => {
  const assets = [
    { name: 'Revio-0.1.5-arm64-mac.zip' },
    { name: 'Revio-0.1.5-x64.dmg' },
    { name: 'Revio-0.1.5-arm64.dmg' },
  ]

  it('prefers the dmg for this architecture, then any dmg', () => {
    expect(pickInstaller(assets, 'arm64')?.name).toBe('Revio-0.1.5-arm64.dmg')
    expect(pickInstaller(assets, 'riscv')?.name).toBe('Revio-0.1.5-x64.dmg')
    expect(pickInstaller([{ name: 'a.zip' }], 'arm64')).toBeUndefined()
  })
})
