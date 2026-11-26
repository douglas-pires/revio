import type { Octokit } from '@octokit/rest'
import { describe, expect, it, vi } from 'vitest'
import { fetchReviewHistory } from './review-history.service.ts'

const pull = (number: number, reviews: { state: string; submittedAt: string | null }[]) => ({
  number,
  title: `PR ${number}`,
  url: `https://github.com/acme/web/pull/${number}`,
  mergedAt: null,
  author: { login: 'bo' },
  repository: { nameWithOwner: 'acme/web' },
  reviews: { nodes: reviews.map((review) => ({ ...review, comments: { nodes: [null] } })) },
})

describe('fetchReviewHistory', () => {
  it('reads every page, one past review per review sent, newest first', async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce({
        search: {
          pageInfo: { hasNextPage: true, endCursor: 'c1' },
          nodes: [pull(1, [{ state: 'COMMENTED', submittedAt: '2026-10-01T00:00:00Z' }]), {}],
        },
      })
      .mockResolvedValueOnce({
        search: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            pull(2, [
              { state: 'APPROVED', submittedAt: '2026-11-01T00:00:00Z' },
              { state: 'PENDING', submittedAt: null },
            ]),
          ],
        },
      })
    const octokit = { graphql } as unknown as Octokit
    const reviews = await fetchReviewHistory(octokit, 'ana', 90, Date.parse('2026-11-25T00:00:00Z'))
    expect(reviews.map((review) => [review.number, review.state, review.comments.length])).toEqual([
      [2, 'APPROVED', 0],
      [1, 'COMMENTED', 0],
    ])
    expect(graphql.mock.calls[0]?.[1]).toMatchObject({
      search: 'is:pr reviewed-by:@me -author:@me updated:>=2026-08-27 sort:updated-desc',
      login: 'ana',
    })
    expect(graphql.mock.calls[1]?.[1]).toMatchObject({ after: 'c1' })
  })
})
