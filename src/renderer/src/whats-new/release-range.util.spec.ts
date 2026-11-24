import type { ReleaseNotes } from '@shared/whats-new.types.ts'
import { describe, expect, it } from 'vitest'
import { dropLaterReleases, listNewVersions } from './release-range.util.ts'

const releases = ['0.4.0', '0.3.0', '0.2.4', '0.2.3'].map((version) => ({ version }) as ReleaseNotes)
const readVersions = (notes: readonly ReleaseNotes[]) => notes.map(({ version }) => version)

describe('dropLaterReleases', () => {
  it('starts at the running release', () => {
    expect(readVersions(dropLaterReleases(releases, '0.3.0'))).toEqual(['0.3.0', '0.2.4', '0.2.3'])
  })

  it('keeps them all for a build that is not a release', () => {
    expect(dropLaterReleases(releases, '0.0.0')).toHaveLength(releases.length)
  })
})

describe('listNewVersions', () => {
  it('is every release since the one last used', () => {
    expect([...listNewVersions(releases, '0.2.4')]).toEqual(['0.4.0', '0.3.0'])
  })

  it('is just the latest when the one last used is not known, and all of them when it is long gone', () => {
    expect([...listNewVersions(releases, null)]).toEqual(['0.4.0'])
    expect(listNewVersions(releases, '0.1.0').size).toBe(releases.length)
  })
})
