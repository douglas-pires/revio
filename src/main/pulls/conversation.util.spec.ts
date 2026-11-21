import { describe, expect, it } from 'vitest'
import { buildConversation, type RawIssueComment, type RawReviewSummary } from './conversation.util.ts'

const readAvatar = (url?: string) => `${url ?? ''}?s=40`
const comment = (id: number, createdAt: string): RawIssueComment => ({
  id,
  body: `comment ${id}`,
  html_url: `https://github.com/acme/web/pull/1#issuecomment-${id}`,
  created_at: createdAt,
  user: { login: 'ana', avatar_url: 'https://avatars/ana' },
})
const review = (id: number, submittedAt: string, body: string, state = 'COMMENTED'): RawReviewSummary => ({
  id,
  body,
  html_url: `https://github.com/acme/web/pull/1#pullrequestreview-${id}`,
  submitted_at: submittedAt,
  state,
  user: { login: 'bo' },
})

describe('buildConversation', () => {
  it('merges comments and review summaries oldest first', () => {
    const conversation = buildConversation(
      [comment(1, '2026-11-20T10:00:00Z'), comment(2, '2026-11-20T12:00:00Z')],
      [review(7, '2026-11-20T11:00:00Z', 'Looks good overall')],
      readAvatar,
    )
    expect(conversation.map((entry) => entry.id)).toEqual(['comment-1', 'review-7', 'comment-2'])
    expect(conversation[0]).toMatchObject({ kind: 'comment', author: 'ana', authorAvatar: 'https://avatars/ana?s=40' })
    expect(conversation[1]).toMatchObject({ kind: 'review', author: 'bo', body: 'Looks good overall' })
  })

  it('leaves out reviews with no summary and pending ones', () => {
    const conversation = buildConversation(
      [],
      [review(1, '2026-11-20T10:00:00Z', '   '), review(2, '2026-11-20T10:00:00Z', 'Draft', 'PENDING')],
      readAvatar,
    )
    expect(conversation).toEqual([])
  })
})
