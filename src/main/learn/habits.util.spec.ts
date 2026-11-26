import type { CommentKind } from '@shared/comment-kinds.util.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { describe, expect, it } from 'vitest'
import { summarizeHabits } from './habits.util.ts'

const review = (number: number, state: PastReview['state'], paths: string[]): PastReview => ({
  repo: 'acme/web',
  number,
  title: '',
  url: '',
  author: 'bo',
  mergedAt: null,
  state,
  submittedAt: '2026-10-01T00:00:00Z',
  comments: paths.map((path, index) => ({ body: '', path, url: `u${number}-${index}`, createdAt: '' })),
})

describe('summarizeHabits', () => {
  const reviews = [
    review(1, 'COMMENTED', ['src/cart/a.ts', 'src/cart/b.ts']),
    review(1, 'APPROVED', []),
    review(2, 'APPROVED', []),
    review(3, 'CHANGES_REQUESTED', ['src/search/q.ts']),
  ]

  it('counts reviews, PRs, comments, approvals without comments and the busiest folders', () => {
    const habits = summarizeHabits(reviews, {})
    expect([habits.reviews, habits.pulls, habits.comments, habits.approvals, habits.silentApprovals]).toEqual([
      4, 3, 3, 2, 1,
    ])
    expect(habits.topFolders).toEqual([
      { folder: 'acme/web/src/cart', count: 2 },
      { folder: 'acme/web/src/search', count: 1 },
    ])
    expect(habits.rarelyChecked).toEqual([])
  })

  it('counts kinds, and names the code concerns you seldom raise once enough comments are sorted', () => {
    const many = review(
      9,
      'COMMENTED',
      Array.from({ length: 40 }, () => 'src/x.ts'),
    )
    const naming: CommentKind[] = ['naming']
    const logicAndTests: CommentKind[] = ['correctness', 'tests']
    const kinds = Object.fromEntries(
      many.comments.map((comment, index) => [
        comment.url,
        [naming, logicAndTests][Math.min(1, Math.floor(index / 30))] ?? [],
      ]),
    )
    const habits = summarizeHabits([many], kinds)
    expect(habits.kinds).toEqual([
      { kind: 'naming', count: 30 },
      { kind: 'correctness', count: 10 },
      { kind: 'tests', count: 10 },
    ])
    expect(habits.rarelyChecked).toEqual(['error-handling', 'security', 'performance', 'design', 'readability'])
  })
})
