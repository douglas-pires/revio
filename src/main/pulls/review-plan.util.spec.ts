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
    expect(plan.fileComments).toEqual([])
  })

  it('keeps comments on whole files apart, and replies to file threads stay replies', () => {
    const plan = planReview([makeDraft({ line: null, body: 'rename this file?' }), makeDraft({ line: null, inReplyTo: 9, body: 'agreed' })])
    expect(plan).toEqual({ replies: [{ commentId: 9, body: 'agreed' }], lineComments: [], fileComments: [{ path: 'a.ts', body: 'rename this file?' }] })
  })
})
