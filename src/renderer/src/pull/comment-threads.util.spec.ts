import { describe, expect, it } from 'vitest'
import type { ReviewComment } from '@shared/types'
import { groupCommentThreads } from '@/pull/comment-threads.util'

const makeComment = (id: number, over: Partial<ReviewComment> = {}): ReviewComment => ({
  id, path: 'b.ts', line: 10, startLine: null, side: 'RIGHT', body: `c${id}`, author: 'bo', authorAvatar: '',
  createdAt: `2026-11-0${id}T00:00:00Z`, url: '', outdated: false, ...over,
})

describe('groupCommentThreads', () => {
  it('puts replies under their first comment in time order, with resolved status', () => {
    const comments = [makeComment(1), makeComment(3, { inReplyTo: 1 }), makeComment(2, { inReplyTo: 1 })]
    const [thread, ...rest] = groupCommentThreads(comments, [{ id: 'T1', rootCommentId: 1, resolved: true }], ['b.ts'])
    expect(rest).toEqual([])
    expect(thread).toMatchObject({ rootId: 1, threadId: 'T1', resolved: true })
    expect(thread!.comments.map((c) => c.id)).toEqual([1, 2, 3])
  })

  it('orders threads like the file list, then by line, outdated last', () => {
    const comments = [makeComment(1, { path: 'b.ts', line: 5 }), makeComment(2, { path: 'a.ts', line: null, outdated: true }), makeComment(3, { path: 'a.ts', line: 7 })]
    expect(groupCommentThreads(comments, [], ['a.ts', 'b.ts']).map((t) => t.rootId)).toEqual([3, 2, 1])
  })

  it('keeps a reply whose first comment is missing as its own thread, unresolved when status is unknown', () => {
    const [thread] = groupCommentThreads([makeComment(4, { inReplyTo: 99 })], [], ['b.ts'])
    expect(thread).toMatchObject({ rootId: 4, threadId: null, resolved: false })
  })
})
