import type { PullDetail } from '@shared/pull.types.ts'
import { describe, expect, it } from 'vitest'
import { hasSameContent } from './pull-content.util.ts'

const makePull = (over: Partial<PullDetail> = {}) =>
  ({ fetchedAt: '2026-01-01T00:00:00Z', title: 'Fix', files: [], comments: [], ...over }) as unknown as PullDetail

describe('hasSameContent', () => {
  it('ignores when the copies were fetched', () => {
    expect(hasSameContent(makePull(), makePull({ fetchedAt: '2026-01-02T00:00:00Z' }))).toBe(true)
  })

  it('sees a change in content', () => {
    expect(hasSameContent(makePull(), makePull({ title: 'Fix it' }))).toBe(false)
  })

  it('has nothing to compare with before the first load', () => {
    expect(hasSameContent(null, makePull())).toBe(false)
  })
})
