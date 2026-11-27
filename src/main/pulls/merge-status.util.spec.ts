import { describe, expect, it } from 'vitest'
import { type RawMergeFields, toMergeStatus } from './merge-status.util.ts'

describe('toMergeStatus', () => {
  it('reads checks, open threads, pending reviewers and who asked for changes', () => {
    const raw: RawMergeFields = {
      isDraft: false,
      reviewDecision: 'CHANGES_REQUESTED',
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'BLOCKED',
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
      reviewThreads: { nodes: [{ isResolved: true }, { isResolved: false }, null, { isResolved: false }] },
      latestOpinionatedReviews: { nodes: [{ author: { login: 'ana' }, state: 'CHANGES_REQUESTED' }] },
      reviewRequests: {
        nodes: [
          { requestedReviewer: { __typename: 'User', login: 'lee' } },
          { requestedReviewer: { __typename: 'Team', slug: 'web' } },
          { requestedReviewer: null },
        ],
      },
    }
    expect(toMergeStatus(raw)).toEqual({
      isDraft: false,
      mergeable: 'MERGEABLE',
      mergeState: 'BLOCKED',
      checks: 'FAILURE',
      reviewDecision: 'CHANGES_REQUESTED',
      changesRequestedBy: ['ana'],
      pendingReviewers: ['lee', '@web', 'a team'],
      unresolvedThreads: 2,
    })
  })
})

describe('toMergeStatus without threads', () => {
  it('leaves open threads unknown when the query did not ask for them', () => {
    const raw: RawMergeFields = {
      isDraft: false,
      reviewDecision: null,
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      commits: { nodes: [] },
      latestOpinionatedReviews: null,
      reviewRequests: { nodes: [] },
    }
    expect(toMergeStatus(raw).unresolvedThreads).toBeNull()
  })
})
