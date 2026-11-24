import { describe, expect, it } from 'vitest'
import { listReviewersByVerdict } from './verdict.util.ts'

describe('listReviewersByVerdict', () => {
  const verdicts = [
    { author: { login: 'ana' }, state: 'APPROVED' },
    { author: { login: 'bo' }, state: 'CHANGES_REQUESTED' },
    null,
    { author: null, state: 'APPROVED' },
    { author: { login: 'cy' }, state: 'DISMISSED' },
  ]

  it('lists those who gave that verdict, "ghost" for a deleted account', () => {
    expect(listReviewersByVerdict(verdicts, 'APPROVED')).toEqual(['ana', 'ghost'])
    expect(listReviewersByVerdict(verdicts, 'CHANGES_REQUESTED')).toEqual(['bo'])
  })
})
