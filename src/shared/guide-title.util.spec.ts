import { describe, expect, it } from 'vitest'
import { buildDefaultTitle } from './guide-title.util.ts'

describe('buildDefaultTitle', () => {
  it('names a guide after its scope', () => {
    expect(buildDefaultTitle({ repo: '*', path: '' })).toBe('Global')
    expect(buildDefaultTitle({ repo: 'acme/web', path: 'apps/api/' })).toBe('apps/api')
    expect(buildDefaultTitle({ repo: 'acme/web', path: '' })).toBe('web')
  })
})
