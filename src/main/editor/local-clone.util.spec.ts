import { describe, expect, it } from 'vitest'
import { cloneCandidates, pathInside, remotePointsAt } from './local-clone.util'

describe('remotePointsAt', () => {
  it('matches https and ssh remotes, ignoring case and .git', () => {
    expect(remotePointsAt('https://github.com/Acme/Widgets.git', 'acme/widgets')).toBe(true)
    expect(remotePointsAt('git@github.com:acme/widgets', 'acme/widgets')).toBe(true)
    expect(remotePointsAt('ssh://git@github.com/acme/widgets.git/', 'acme/widgets')).toBe(true)
  })

  it('rejects other repos and hosts', () => {
    expect(remotePointsAt('https://github.com/acme/widgets-old.git', 'acme/widgets')).toBe(false)
    expect(remotePointsAt('https://gitlab.com/acme/widgets.git', 'acme/widgets')).toBe(false)
    expect(remotePointsAt('https://github.com/other/widgets.git', 'acme/widgets')).toBe(false)
  })
})

describe('cloneCandidates', () => {
  it('looks for name and owner/name in the folder and its subfolders', () => {
    expect(cloneCandidates('/u', 'acme/widgets', ['code'])).toEqual(['/u/widgets', '/u/acme/widgets', '/u/code/widgets', '/u/code/acme/widgets'])
  })
})

describe('pathInside', () => {
  it('resolves paths inside the clone', () => {
    expect(pathInside('/r', 'src/a.ts')).toBe('/r/src/a.ts')
  })

  it('refuses paths that leave it', () => {
    expect(pathInside('/r', '../etc/passwd')).toBeNull()
    expect(pathInside('/r', 'src/../../x')).toBeNull()
    expect(pathInside('/r', '/etc/passwd')).toBeNull()
    expect(pathInside('/r', '')).toBeNull()
    expect(pathInside('/r', '.')).toBeNull()
  })
})
