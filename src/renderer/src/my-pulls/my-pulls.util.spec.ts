import { describe, expect, it } from 'vitest'
import { makeSummary } from '../../../../test/fixtures.ts'
import { countPullsNeedingYou, groupMyPulls } from './my-pulls.util.ts'

const idsOf = (pulls: readonly { id: string }[]) => pulls.map((pull) => pull.id)

describe('groupMyPulls', () => {
  const prs = [
    makeSummary({ id: 'wip', isDraft: true, reviewDecision: 'CHANGES_REQUESTED' }),
    makeSummary({ id: 'fix-me', reviewDecision: 'CHANGES_REQUESTED' }),
    makeSummary({ id: 'ship-me', reviewDecision: 'APPROVED' }),
    makeSummary({ id: 'waiting', reviewDecision: 'REVIEW_REQUIRED' }),
    makeSummary({ id: 'no-rules', reviewDecision: null }),
  ]

  it('sorts your PRs by what they need next, drafts apart whatever their reviews say', () => {
    const groups = groupMyPulls(prs)
    expect(idsOf(groups.changesRequested)).toEqual(['fix-me'])
    expect(idsOf(groups.approved)).toEqual(['ship-me'])
    expect(idsOf(groups.inReview)).toEqual(['waiting', 'no-rules'])
    expect(idsOf(groups.drafts)).toEqual(['wip'])
  })

  it('counts only the ready PRs with changes requested as needing you', () => {
    expect(countPullsNeedingYou(prs)).toBe(1)
    expect(countPullsNeedingYou([])).toBe(0)
  })
})
