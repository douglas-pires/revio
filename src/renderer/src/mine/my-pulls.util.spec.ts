import { describe, expect, it } from 'vitest'
import { makeSummary } from '../../../../test/fixtures.ts'
import { groupMyPulls, myPullsNeedingYou } from './my-pulls.util.ts'

const ids = (prs: readonly { id: string }[]) => prs.map((p) => p.id)

describe('groupMyPulls', () => {
  const prs = [
    makeSummary({ id: 'wip', isDraft: true, reviewDecision: 'CHANGES_REQUESTED' }),
    makeSummary({ id: 'fix-me', reviewDecision: 'CHANGES_REQUESTED' }),
    makeSummary({ id: 'ship-me', reviewDecision: 'APPROVED' }),
    makeSummary({ id: 'waiting', reviewDecision: 'REVIEW_REQUIRED' }),
    makeSummary({ id: 'no-rules', reviewDecision: null }),
  ]

  it('sorts your PRs by what they need next, drafts apart whatever their reviews say', () => {
    const g = groupMyPulls(prs)
    expect(ids(g.changesRequested)).toEqual(['fix-me'])
    expect(ids(g.approved)).toEqual(['ship-me'])
    expect(ids(g.inReview)).toEqual(['waiting', 'no-rules'])
    expect(ids(g.drafts)).toEqual(['wip'])
  })

  it('counts only the ready PRs with changes requested as needing you', () => {
    expect(myPullsNeedingYou(prs)).toBe(1)
    expect(myPullsNeedingYou([])).toBe(0)
  })
})
