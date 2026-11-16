import { describe, expect, it } from 'vitest'
import type { DraftComment } from '@shared/pull.types'
import { planReview } from './review-plan.util'

const makeDraft = (over: Partial<DraftComment>): DraftComment => ({ id: 'd', path: 'a.ts', line: 10, side: 'RIGHT', body: 'b', ...over })

describe('planReview', () => {
  it('posts replies separately and keeps line comments, with a range when it spans lines', () => {
    const plan = planReview([makeDraft({ inReplyTo: 7, body: 'ack' }), makeDraft({ line: 12, startLine: 10 }), makeDraft({ startLine: 10 })])
    expect(plan.replies).toEqual([{ commentId: 7, body: 'ack' }])
    expect(plan.lineComments).toEqual([
      { path: 'a.ts', body: 'b', line: 12, side: 'RIGHT', start_line: 10, start_side: 'RIGHT' },
      { path: 'a.ts', body: 'b', line: 10, side: 'RIGHT' },
    ])
  })
})
