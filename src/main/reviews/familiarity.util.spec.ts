import type { PastReview } from '@shared/review-history.types.ts'
import { describe, expect, it } from 'vitest'
import { findUnfamiliarFiles } from './familiarity.util.ts'

const reviewWith = (repo: string, paths: string[]): PastReview => ({
  repo,
  number: 1,
  title: '',
  url: '',
  author: 'bo',
  mergedAt: null,
  state: 'COMMENTED',
  submittedAt: '2026-10-01T00:00:00Z',
  comments: paths.map((path) => ({ body: '', path, url: '', createdAt: '' })),
})

describe('findUnfamiliarFiles', () => {
  const history = [reviewWith('acme/web', ['apps/web/src/app.ts']), reviewWith('acme/api', ['billing/charge.ts'])]

  it('marks files outside the folders you commented in, or the folder above them', () => {
    const paths = ['apps/web/src/other.ts', 'apps/web/src/pages/home.ts', 'apps/web/lib/x.ts', 'billing/charge.ts']
    expect(findUnfamiliarFiles('Acme/Web', paths, history)).toEqual(['apps/web/lib/x.ts', 'billing/charge.ts'])
  })

  it('marks nothing in a repository you never commented in', () => {
    expect(findUnfamiliarFiles('acme/docs', ['a/b.md'], history)).toEqual([])
  })
})
