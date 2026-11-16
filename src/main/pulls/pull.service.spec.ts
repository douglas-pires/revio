import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DraftComment, SubmitReviewInput } from '@shared/pull.types'

const octokit = {
  pulls: {
    createReplyForReviewComment: vi.fn(async () => ({})),
    createReview: vi.fn(async (_args: Record<string, unknown>) => ({ data: { id: 42, node_id: 'PRR_42', html_url: 'review-url' } })),
    submitReview: vi.fn(async () => ({ data: { html_url: 'submitted-url' } })),
    deletePendingReview: vi.fn(async () => ({})),
  },
  graphql: vi.fn(async () => ({})),
}
vi.mock('../github/github.client', () => ({ gh: async () => octokit, smallAvatar: (u: string) => u, viewerLogin: async () => 'me' }))
const { submitReview } = await import('./pull.service')

const input: SubmitReviewInput = { repo: 'acme/web', number: 7, headSha: 'sha', event: 'APPROVE', body: 'LGTM' }
const makeDraft = (over: Partial<DraftComment>): DraftComment => ({ id: 'd', path: 'a.ts', line: 3, side: 'RIGHT', body: 'nit', ...over })

beforeEach(() => vi.clearAllMocks())

describe('submitReview', () => {
  it('submits line comments in one call when there are no file comments', async () => {
    await expect(submitReview(input, [makeDraft({})])).resolves.toEqual({ url: 'review-url' })
    expect(octokit.pulls.createReview).toHaveBeenCalledWith(expect.objectContaining({ event: 'APPROVE', comments: [expect.objectContaining({ line: 3 })] }))
    expect(octokit.graphql).not.toHaveBeenCalled()
  })

  it('adds file comments to a pending review, then submits it', async () => {
    await expect(submitReview(input, [makeDraft({}), makeDraft({ line: null, body: 'split this file?' })])).resolves.toEqual({ url: 'submitted-url' })
    const created = octokit.pulls.createReview.mock.calls[0]![0]
    expect(created).not.toHaveProperty('event')
    expect(octokit.graphql).toHaveBeenCalledWith(expect.stringContaining('subjectType: FILE'), { review: 'PRR_42', path: 'a.ts', body: 'split this file?' })
    expect(octokit.pulls.submitReview).toHaveBeenCalledWith(expect.objectContaining({ review_id: 42, event: 'APPROVE', body: 'LGTM' }))
  })

  it('deletes the pending review when adding a file comment fails', async () => {
    octokit.graphql.mockRejectedValueOnce(new Error('path not in diff'))
    await expect(submitReview(input, [makeDraft({ line: null })])).rejects.toThrow('path not in diff')
    expect(octokit.pulls.deletePendingReview).toHaveBeenCalledWith(expect.objectContaining({ review_id: 42 }))
    expect(octokit.pulls.submitReview).not.toHaveBeenCalled()
  })
})
