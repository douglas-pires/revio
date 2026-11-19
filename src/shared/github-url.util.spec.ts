import { describe, expect, it } from 'vitest'
import { reviewCommentIdFromUrl } from './github-url.util.ts'

describe('reviewCommentIdFromUrl', () => {
  it('reads the id from a review comment link', () => {
    expect(reviewCommentIdFromUrl('https://github.com/o/r/pull/7#discussion_r1234567')).toBe(1_234_567)
  })

  it.each(['https://github.com/o/r/pull/7#issuecomment-55', 'https://github.com/o/r/pull/7', ''])(
    'is null for %j',
    (url) => {
      expect(reviewCommentIdFromUrl(url)).toBeNull()
    },
  )
})
