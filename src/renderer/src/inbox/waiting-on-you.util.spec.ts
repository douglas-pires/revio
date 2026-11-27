import type { MergeStatus } from '@shared/merge-status.types.ts'
import { describe, expect, it } from 'vitest'
import { makeSummary } from '../../../../test/fixtures.ts'
import { isLastBlocker, summarizeWaiting } from './waiting-on-you.util.ts'

const status = (over: Partial<MergeStatus> = {}): MergeStatus => ({
  isDraft: false,
  mergeable: 'MERGEABLE',
  mergeState: 'BLOCKED',
  checks: 'SUCCESS',
  reviewDecision: 'REVIEW_REQUIRED',
  changesRequestedBy: [],
  pendingReviewers: ['me'],
  unresolvedThreads: null,
  ...over,
})

describe('isLastBlocker', () => {
  it('is true when only you (or your team) are left and nothing else is in the way', () => {
    expect(isLastBlocker(status(), 'me', null)).toBe(true)
    expect(isLastBlocker(status({ pendingReviewers: ['@web'] }), 'me', 'web')).toBe(true)
    expect(isLastBlocker(status({ checks: 'PENDING' }), 'me', null)).toBe(true)
  })

  it('is false when others are left too, or something else blocks', () => {
    expect(isLastBlocker(status({ pendingReviewers: ['me', 'ana'] }), 'me', null)).toBe(false)
    expect(isLastBlocker(status({ checks: 'FAILURE' }), 'me', null)).toBe(false)
    expect(isLastBlocker(status({ mergeable: 'CONFLICTING' }), 'me', null)).toBe(false)
    expect(isLastBlocker(status({ pendingReviewers: [] }), 'me', null)).toBe(false)
  })
})

describe('summarizeWaiting', () => {
  it('counts PRs and people, finds the longest wait, and how many only need you', () => {
    const requested = [
      makeSummary({ number: 1, author: 'mara', waitingHours: 30 }),
      makeSummary({ number: 2, author: 'lee', waitingHours: 4 }),
      makeSummary({ number: 3, author: 'mara', waitingHours: 2 }),
    ]
    const statuses = { 'acme/web#2': status(), 'acme/web#3': status({ pendingReviewers: ['me', 'tom'] }) }
    expect(summarizeWaiting(requested, statuses, 'me')).toEqual({
      pulls: 3,
      people: 2,
      longest: { author: 'mara', hours: 30 },
      lastBlocker: 1,
    })
  })
})
