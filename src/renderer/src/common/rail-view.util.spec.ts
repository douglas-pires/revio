import { describe, expect, it } from 'vitest'
import { pickRailView, readListOrigin } from './rail-view.util.ts'

const PULL = { repo: 'acme/web', number: 1 }

describe('readListOrigin', () => {
  it('is the list a PR is opened from', () => {
    expect(readListOrigin({ view: 'my-pulls' })).toBe('my-pulls')
    expect(readListOrigin({ view: 'mentions' })).toBe('mentions')
  })

  it('carries over to a PR opened from another PR', () => {
    expect(readListOrigin({ view: 'pull', pull: PULL, from: 'my-pulls' })).toBe('my-pulls')
  })

  it('is none from a screen that is not a list', () => {
    expect(readListOrigin({ view: 'guidelines' })).toBeUndefined()
  })
})

describe('pickRailView', () => {
  it('keeps a PR under the list it was opened from', () => {
    expect(pickRailView({ view: 'pull', pull: PULL, from: 'my-pulls' })).toBe('my-pulls')
  })

  it('puts a PR with no list (from a notification, say) under the inbox', () => {
    expect(pickRailView({ view: 'pull', pull: PULL })).toBe('inbox')
  })

  it('is the screen itself otherwise', () => {
    expect(pickRailView({ view: 'settings' })).toBe('settings')
  })
})
