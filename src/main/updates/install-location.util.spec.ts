import { describe, expect, it } from 'vitest'
import { findReplaceableFolder } from './install-location.util.ts'

describe('findReplaceableFolder', () => {
  it('is the folder holding the app', () => {
    expect(findReplaceableFolder('/Applications/Revio.app/Contents/MacOS/Revio')).toBe('/Applications')
    expect(findReplaceableFolder('/Users/ana/Applications/Revio.app/Contents/MacOS/Revio')).toBe(
      '/Users/ana/Applications',
    )
  })

  it('is null in the dmg, in the copy macOS runs a fresh download from, and outside an app', () => {
    expect(findReplaceableFolder('/Volumes/Revio 0.3.0/Revio.app/Contents/MacOS/Revio')).toBeNull()
    expect(findReplaceableFolder('/private/var/x/AppTranslocation/1/d/Revio.app/Contents/MacOS/Revio')).toBeNull()
    expect(findReplaceableFolder('/usr/local/bin/electron')).toBeNull()
  })
})
