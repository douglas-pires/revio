import type { CommentKind } from '@shared/comment-kinds.util.ts'
import type { HabitsFilter } from '@shared/learn.types.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { describe, expect, it } from 'vitest'
import { summarizeHabits } from './habits.util.ts'

const ALL: HabitsFilter = { days: 365, scope: '' }
const NOW = Date.parse('2026-11-01T00:00:00Z')

const review = (number: number, state: PastReview['state'], paths: string[], repo = 'acme/web'): PastReview => ({
  repo,
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
    const habits = summarizeHabits(reviews, {}, ALL, NOW)
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
    const habits = summarizeHabits([many], kinds, ALL, NOW)
    expect(habits.kinds).toEqual([
      { kind: 'naming', count: 30 },
      { kind: 'correctness', count: 10 },
      { kind: 'tests', count: 10 },
    ])
    expect(habits.rarelyChecked).toEqual(['error-handling', 'security', 'performance', 'design', 'readability'])
  })

  it('counts only the reviews in the period and the organisation or repository picked', () => {
    const spread = [
      { ...review(1, 'COMMENTED', ['a.ts'], 'acme/web'), submittedAt: '2026-10-20T00:00:00Z' },
      { ...review(2, 'COMMENTED', ['b.ts'], 'acme/api'), submittedAt: '2026-10-10T00:00:00Z' },
      { ...review(3, 'COMMENTED', ['c.ts'], 'other/site'), submittedAt: '2026-10-05T00:00:00Z' },
      { ...review(4, 'COMMENTED', ['d.ts'], 'acme/web'), submittedAt: '2026-06-01T00:00:00Z' },
    ]
    const month = summarizeHabits(spread, {}, { days: 30, scope: 'acme' }, NOW)
    expect([month.reviews, month.repoCount, month.from, month.to]).toEqual([
      2,
      2,
      '2026-10-10T00:00:00Z',
      '2026-10-20T00:00:00Z',
    ])
    expect(month.repos.map((repo) => repo.repo)).toEqual(['acme/api', 'acme/web', 'other/site'])
    expect(summarizeHabits(spread, {}, { days: 365, scope: 'acme/web' }, NOW).reviews).toBe(2)
  })
})
