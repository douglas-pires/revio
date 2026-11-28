import { describe, expect, it } from 'vitest'
import { buildPeopleSearches, type RawStatsPull, splitIntoWindows, toStatsPull } from './stats-pull.util.ts'

const RAW: RawStatsPull = {
  number: 7,
  title: 'feat: a thing',
  url: 'https://github.com/acme/web/pull/7',
  createdAt: '2026-11-01T10:00:00Z',
  mergedAt: '2026-11-03T10:00:00Z',
  closedAt: '2026-11-03T10:00:00Z',
  additions: 10,
  deletions: 2,
  changedFiles: 1,
  author: { login: 'mara' },
  repository: { nameWithOwner: 'acme/web' },
  commits: { nodes: [{ commit: { authoredDate: '2026-10-31T10:00:00Z' } }] },
  timelineItems: {
    nodes: [
      { __typename: 'ReadyForReviewEvent', createdAt: '2026-11-01T12:00:00Z' },
      { __typename: 'ReviewRequestedEvent', createdAt: '2026-11-01T12:00:00Z', requestedReviewer: { login: 'lee' } },
      {
        __typename: 'ReviewRequestedEvent',
        createdAt: '2026-11-01T12:00:00Z',
        requestedReviewer: { slug: 'web', organization: { login: 'acme' } },
      },
      { __typename: 'ReviewRequestedEvent', createdAt: '2026-11-01T12:00:00Z', requestedReviewer: null },
    ],
  },
  reviews: {
    nodes: [
      { author: { login: 'lee' }, state: 'APPROVED', submittedAt: '2026-11-02T09:00:00Z', comments: { totalCount: 2 } },
      { author: null, state: 'COMMENTED', submittedAt: '2026-11-02T09:00:00Z', comments: { totalCount: 0 } },
    ],
  },
}

describe('toStatsPull', () => {
  it('reads requests to people and teams, reviews, and when it was ready', () => {
    const pull = toStatsPull(RAW)
    expect(pull?.readyAt).toBe('2026-11-01T12:00:00Z')
    expect(pull?.firstCommitAt).toBe('2026-10-31T10:00:00Z')
    expect(pull?.requests.map((request) => request.reviewer)).toEqual(['lee', '@acme/web'])
    expect(pull?.reviews).toEqual([
      { reviewer: 'lee', state: 'APPROVED', submittedAt: '2026-11-02T09:00:00Z', comments: 2 },
    ])
  })

  it('is ready when opened, without a draft', () => {
    expect(toStatsPull({ ...RAW, timelineItems: { nodes: [] } })?.readyAt).toBe(RAW.createdAt)
  })

  it('skips search results that are not PRs', () => {
    const { number: _skipped, ...searchResult } = RAW
    expect(toStatsPull(searchResult)).toBeNull()
  })
})

describe('buildPeopleSearches', () => {
  it('puts every author in one search when it fits', () => {
    expect(buildPeopleSearches('author', ['a', 'b'], 'is:pr')).toEqual(['is:pr author:a author:b'])
    expect(buildPeopleSearches('reviewed-by', ['a'], 'is:pr')).toEqual(['is:pr reviewed-by:a'])
  })

  it('splits long lists so each search fits', () => {
    const authors = Array.from({ length: 40 }, (_, index) => `someone-${index}`)
    const searches = buildPeopleSearches('author', authors, 'is:pr created:>=2026-01-01')
    expect(searches.length).toBeGreaterThan(1)
    expect(searches.every((search) => search.length <= 256)).toBe(true)
    expect(searches.join(' ').match(/author:/gu)).toHaveLength(40)
  })

  it('makes no search for no authors', () => {
    expect(buildPeopleSearches('author', [], 'is:pr')).toEqual([])
  })
})

describe('splitIntoWindows', () => {
  it('covers the period in 15-day ranges up to today', () => {
    const now = Date.parse('2026-11-28T12:00:00Z')
    expect(splitIntoWindows(now - 30 * 86_400_000, now)).toEqual([
      '2026-10-29..2026-11-12',
      '2026-11-13..2026-11-27',
      '2026-11-28..2026-11-28',
    ])
  })
})
