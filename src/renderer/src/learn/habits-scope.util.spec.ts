import { describe, expect, it } from 'vitest'
import { buildScopeOptions, shortenFolder } from './habits-scope.util.ts'

describe('buildScopeOptions', () => {
  it('offers everything, each organisation, then each repository', () => {
    const options = buildScopeOptions([
      { repo: 'acme/web', reviews: 5 },
      { repo: 'other/site', reviews: 3 },
      { repo: 'acme/api', reviews: 2 },
    ])
    expect(options.map((option) => option.value)).toEqual(['', 'acme', 'other', 'acme/web', 'other/site', 'acme/api'])
    expect(options[1]?.label).toBe('acme (organisation, 7)')
  })
})

describe('shortenFolder', () => {
  it('drops the repository picked, and shortens the middle of long folders', () => {
    expect(shortenFolder('acme/web/src/cart', 'acme/web')).toBe('src/cart')
    expect(shortenFolder('acme/web/src/cart', 'acme')).toBe('acme/web/src/cart')
    expect(shortenFolder('acme/web/apps/frontend/src/services/booking/validators', '')).toBe(
      'acme/web/…/booking/validators',
    )
  })
})
