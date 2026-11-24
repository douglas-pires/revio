import { describe, expect, it } from 'vitest'
import { findUnseenUpdate } from './unseen-update.util.ts'

const find = (current: string, seen: string | null, usedBefore = true) =>
  findUnseenUpdate({ current, seen, usedBefore })

describe('findUnseenUpdate', () => {
  it('finds a newer release than the one last seen', () => {
    expect(find('0.3.0', '0.2.4')).toEqual({ previous: '0.2.4' })
  })

  it('finds nothing for the same release, or an older one', () => {
    expect(find('0.3.0', '0.3.0')).toBeNull()
    expect(find('0.2.4', '0.3.0')).toBeNull()
  })

  it('leaves out pre-releases and builds from source', () => {
    expect(find('0.3.1-dev.50', '0.3.0')).toBeNull()
    expect(find('0.0.0', null)).toBeNull()
  })

  it('tells someone new from someone who used Revio before this was kept track of', () => {
    expect(find('0.3.0', null, false)).toBeNull()
    expect(find('0.3.0', null, true)).toEqual({ previous: null })
  })
})
