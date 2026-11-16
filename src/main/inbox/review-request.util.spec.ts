import { describe, expect, it } from 'vitest'
import { awaitsYou, classifyRequest, type RawReviewer, type RequestEvent } from './review-request.util'

const me: RawReviewer = { __typename: 'User', login: 'me' }
const other: RawReviewer = { __typename: 'User', login: 'bo' }
const web: RawReviewer = { __typename: 'Team', slug: 'web' }
const hiddenTeam: RawReviewer = null
const event = (createdAt: string, requestedReviewer: RawReviewer): RequestEvent => ({ createdAt, requestedReviewer })

describe('classifyRequest', () => {
  it('is direct when you are among the pending reviewers, dated by your own request', () => {
    expect(classifyRequest([web, me], [event('t1', me), event('t2', web)], 'me')).toEqual({ viaTeam: null, requestedAt: 't1' })
  })

  it('names the team when GitHub shows it', () => {
    expect(classifyRequest([other, web], [event('t1', web), event('t2', other)], 'me')).toEqual({ viaTeam: 'web', requestedAt: 't1' })
  })

  it('treats a hidden reviewer (token without read:org) as a team, not as you', () => {
    expect(classifyRequest([hiddenTeam, other], [event('t1', hiddenTeam), event('t2', other)], 'me')).toEqual({ viaTeam: 'team', requestedAt: 't1' })
  })

  it('ignores an old direct request that was since removed', () => {
    expect(classifyRequest([hiddenTeam], [event('t1', me), event('t2', hiddenTeam)], 'me')).toEqual({ viaTeam: 'team', requestedAt: 't2' })
  })

  it('has no time when the timeline was cut off', () => {
    expect(classifyRequest([web], [], 'me')).toEqual({ viaTeam: 'web', requestedAt: null })
  })
})

describe('awaitsYou', () => {
  const request = (requestedAt: string | null) => ({ viaTeam: 'web', requestedAt })

  it('waits on you until you review', () => {
    expect(awaitsYou(request('2026-11-10T10:00:00Z'), null)).toBe(true)
  })

  it('stops once you reviewed after the request, even if the team request remains', () => {
    expect(awaitsYou(request('2026-11-10T10:00:00Z'), '2026-11-16T21:19:18Z')).toBe(false)
  })

  it('waits again when you are asked again after your review', () => {
    expect(awaitsYou(request('2026-11-17T09:00:00Z'), '2026-11-16T21:19:18Z')).toBe(true)
  })

  it('counts any review when the request time is unknown', () => {
    expect(awaitsYou(request(null), '2026-11-16T21:19:18Z')).toBe(false)
  })
})
