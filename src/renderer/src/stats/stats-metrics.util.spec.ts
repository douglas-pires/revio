import type { StatsData, StatsPull } from '@shared/stats.types.ts'
import { describe, expect, it } from 'vitest'
import { groupBySize, measureCycleTimes, summarizeCycleTimes } from './stats-cycle.util.ts'
import { findReviewWaits, summarizeReviewers } from './stats-reviews.util.ts'
import { listWeeks, median, percentile, readWeekStart } from './stats-time.util.ts'
import { groupByWeek } from './stats-weeks.util.ts'

const HOUR = 3_600_000
const at = (hours: number) => new Date(Date.parse('2026-11-02T00:00:00Z') + hours * HOUR).toISOString()
const SINCE = Date.parse('2026-11-01T00:00:00Z')
const NOW = Date.parse('2026-11-15T00:00:00Z')

function makePull(over: Partial<StatsPull>): StatsPull {
  return {
    repo: 'acme/web',
    number: 1,
    title: 'feat: a thing',
    url: `https://github.com/acme/web/pull/${over.number ?? 1}`,
    author: 'mara',
    createdAt: at(0),
    readyAt: at(0),
    firstCommitAt: at(-10),
    mergedAt: null,
    closedAt: null,
    additions: 40,
    deletions: 10,
    changedFiles: 3,
    requests: [],
    reviews: [],
    ...over,
  }
}

const MERGED = makePull({
  number: 1,
  readyAt: at(2),
  mergedAt: at(30),
  requests: [
    { reviewer: 'lee', at: at(2) },
    { reviewer: 'lee', at: at(20) },
  ],
  reviews: [
    { reviewer: 'lee', state: 'CHANGES_REQUESTED', submittedAt: at(6), comments: 3 },
    { reviewer: 'lee', state: 'APPROVED', submittedAt: at(24), comments: 0 },
    { reviewer: 'mara', state: 'COMMENTED', submittedAt: at(7), comments: 1 },
  ],
})
const WAITING = makePull({
  number: 2,
  author: 'lee',
  additions: 900,
  requests: [{ reviewer: 'mara', at: at(1) }],
})
const data = (over: Partial<StatsData> = {}): StatsData => ({
  scope: { kind: 'repo', repo: 'acme/web' },
  days: 30,
  viewer: 'mara',
  people: null,
  pulls: [MERGED, WAITING],
  truncated: false,
  fetchedAt: new Date(NOW).toISOString(),
  ...over,
})

describe('time helpers', () => {
  it('finds the median and a percentile', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([])).toBeNull()
    expect(percentile([0, 10], 0.9)).toBe(9)
  })

  it('starts weeks on Monday', () => {
    expect(readWeekStart('2026-11-04T12:00:00Z')).toBe('2026-11-02')
    expect(readWeekStart('2026-11-01T12:00:00Z')).toBe('2026-10-26')
    expect(listWeeks(SINCE, NOW)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09'])
  })
})

describe('findReviewWaits', () => {
  it('times the first request to each reviewer, and leaves unanswered ones waiting', () => {
    const waits = findReviewWaits(data(), SINCE)
    expect(waits.map((wait) => [wait.reviewer, wait.waitMs])).toEqual([
      ['lee', 4 * HOUR],
      ['mara', null],
    ])
  })

  it('follows only the scope’s people', () => {
    expect(findReviewWaits(data({ people: ['mara'] }), SINCE).map((wait) => wait.reviewer)).toEqual(['mara'])
  })

  it('counts a team request answered by any member, for that team', () => {
    const pull = makePull({
      requests: [{ reviewer: '@acme/web', at: at(0) }],
      reviews: [{ reviewer: 'tom', state: 'APPROVED', submittedAt: at(3), comments: 0 }],
    })
    const team = data({
      scope: { kind: 'team', teams: [{ org: 'acme', slug: 'web', name: 'Web' }] },
      people: ['tom'],
      pulls: [pull],
    })
    expect(findReviewWaits(team, SINCE).map((wait) => wait.waitMs)).toEqual([3 * HOUR])
  })

  it('follows requests to any of several picked teams', () => {
    const pull = makePull({
      requests: [{ reviewer: '@acme/api', at: at(0) }],
      reviews: [{ reviewer: 'tom', state: 'APPROVED', submittedAt: at(2), comments: 0 }],
    })
    const teams = [
      { org: 'acme', slug: 'web', name: 'Web' },
      { org: 'acme', slug: 'api', name: 'API' },
    ]
    const stats = data({ scope: { kind: 'team', teams }, people: ['tom'], pulls: [pull] })
    expect(findReviewWaits(stats, SINCE).map((wait) => wait.waitMs)).toEqual([2 * HOUR])
  })
})

describe('summarizeReviewers', () => {
  it('counts each reviewer’s reviews on others’ PRs', () => {
    const stats = data()
    const [lee] = summarizeReviewers(stats, SINCE, findReviewWaits(stats, SINCE))
    expect(lee).toEqual({
      reviewer: 'lee',
      reviews: 2,
      approvals: 1,
      changesRequested: 1,
      comments: 3,
      medianWaitMs: 4 * HOUR,
    })
  })
})

describe('measureCycleTimes', () => {
  it('splits a merged PR into coding, waiting, reviewing and merging', () => {
    const [cycle] = measureCycleTimes(data(), SINCE)
    expect(cycle).toMatchObject({
      codingMs: 12 * HOUR,
      waitingMs: 4 * HOUR,
      reviewingMs: 18 * HOUR,
      mergingMs: 6 * HOUR,
      totalMs: 40 * HOUR,
    })
    expect(summarizeCycleTimes([cycle!]).totalMs).toBe(40 * HOUR)
  })

  it('leaves out PRs merged before the period or by others', () => {
    expect(measureCycleTimes(data(), Date.parse(at(31)))).toEqual([])
    expect(measureCycleTimes(data({ people: ['lee'] }), SINCE)).toEqual([])
  })

  it('counts a PR merged without a review as all waiting', () => {
    const pull = makePull({ mergedAt: at(5) })
    expect(measureCycleTimes(data({ pulls: [pull] }), SINCE)[0]).toMatchObject({ waitingMs: 5 * HOUR, reviewingMs: 0 })
  })
})

describe('groupBySize', () => {
  it('puts PRs in size buckets by lines changed', () => {
    const stats = data()
    const sizes = groupBySize(stats, SINCE, measureCycleTimes(stats, SINCE))
    expect(sizes.map((size) => [size.label, size.pulls])).toEqual([
      ['XS', 0],
      ['S', 1],
      ['M', 0],
      ['L', 1],
      ['XL', 0],
    ])
    expect(sizes[1]?.medianWaitMs).toBe(4 * HOUR)
  })
})

describe('groupByWeek', () => {
  it('counts merges, requests and reviews per week', () => {
    const stats = data()
    const weeks = groupByWeek(
      stats,
      { since: SINCE, now: NOW },
      measureCycleTimes(stats, SINCE),
      findReviewWaits(stats, SINCE),
    )
    expect(weeks.find((week) => week.week === '2026-11-02')).toMatchObject({
      merged: 1,
      requestsIn: 2,
      reviewsOut: 2,
    })
  })
})
