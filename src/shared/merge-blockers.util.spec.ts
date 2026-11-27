import { describe, expect, it } from 'vitest'
import { describeBlockers } from './merge-blockers.util.ts'
import type { MergeStatus } from './merge-status.types.ts'

const status = (over: Partial<MergeStatus> = {}): MergeStatus => ({
  isDraft: false,
  mergeable: 'MERGEABLE',
  mergeState: 'CLEAN',
  checks: 'SUCCESS',
  reviewDecision: 'APPROVED',
  changesRequestedBy: [],
  pendingReviewers: [],
  unresolvedThreads: 0,
  ...over,
})

const labels = (over: Partial<MergeStatus>) => describeBlockers(status(over)).map((blocker) => blocker.label)

describe('describeBlockers', () => {
  it('says ready when nothing blocks and GitHub agrees', () => {
    expect(labels({})).toEqual(['ready to merge'])
  })

  it('lists what blocks, most pressing first', () => {
    expect(
      labels({
        mergeable: 'CONFLICTING',
        mergeState: 'DIRTY',
        checks: 'FAILURE',
        reviewDecision: 'CHANGES_REQUESTED',
        changesRequestedBy: ['ana'],
        pendingReviewers: ['lee', '@acme/web', 'tom'],
        unresolvedThreads: 3,
      }),
    ).toEqual(['conflicts', 'checks failing', 'changes asked by ana', 'waiting on lee, @acme/web +1', '3 open threads'])
  })

  it('reads GitHub’s verdict when nothing else explains it', () => {
    expect(labels({ mergeState: 'BEHIND' })).toEqual(['behind its base'])
    expect(labels({ mergeState: 'BLOCKED' })).toEqual(['blocked by rules'])
    expect(labels({ mergeState: 'BLOCKED', checks: 'PENDING' })).toEqual(['checks running'])
    expect(labels({ reviewDecision: 'REVIEW_REQUIRED', mergeState: 'BLOCKED' })).toEqual(['needs a review'])
  })

  it('names a draft first', () => {
    expect(labels({ isDraft: true, mergeState: 'DRAFT' })[0]).toBe('draft')
  })

  it('names you "you", first', () => {
    expect(describeBlockers(status({ pendingReviewers: ['lee', 'me'] }), 'me').map((blocker) => blocker.label)).toEqual(
      ['waiting on you, lee'],
    )
  })
})
