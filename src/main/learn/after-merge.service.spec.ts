import type { PastReview } from '@shared/review-history.types.ts'
import { describe, expect, it } from 'vitest'
import { listApprovedMerged } from './after-merge.service.ts'

const review = (number: number, state: PastReview['state'], submittedAt: string, mergedAt: string | null) => ({
  repo: 'acme/web',
  number,
  title: '',
  url: '',
  author: 'bo',
  mergedAt,
  state,
  submittedAt,
  comments: [],
})

describe('listApprovedMerged', () => {
  it('keeps merged PRs you approved, once each, at your last approval, newest merge first', () => {
    const approved = listApprovedMerged([
      review(1, 'APPROVED', '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z'),
      review(1, 'APPROVED', '2026-09-03T00:00:00Z', '2026-09-02T00:00:00Z'),
      review(2, 'APPROVED', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
      review(3, 'COMMENTED', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
      review(4, 'APPROVED', '2026-10-01T00:00:00Z', null),
    ])
    expect(approved.map((pull) => [pull.number, pull.approvedAt])).toEqual([
      [2, '2026-10-01T00:00:00Z'],
      [1, '2026-09-03T00:00:00Z'],
    ])
  })
})
