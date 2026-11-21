import type { ConversationComment, DraftComment, ReviewComment } from '@shared/pull.types.ts'
import { describe, expect, it } from 'vitest'
import {
  collectCommentedLines,
  findMatchingComment,
  findNewComments,
  groupCommentThreads,
  indexFileComments,
  searchConversation,
  searchDrafts,
  searchThreads,
} from '@/pull/comment-threads.util.ts'
import { assertPresent } from '../../../../test/fixtures.ts'

const makeComment = (id: number, over: Partial<ReviewComment> = {}): ReviewComment => ({
  id,
  path: 'b.ts',
  line: 10,
  startLine: null,
  side: 'RIGHT',
  body: `c${id}`,
  author: 'bo',
  authorAvatar: '',
  createdAt: `2026-11-0${id}T00:00:00Z`,
  url: '',
  outdated: false,
  subjectType: 'line',
  nodeId: `N${id}`,
  reactions: [],
  ...over,
})

describe('groupCommentThreads', () => {
  it('puts replies under their first comment in time order, with resolved status', () => {
    const comments = [makeComment(1), makeComment(3, { inReplyTo: 1 }), makeComment(2, { inReplyTo: 1 })]
    const [thread, ...rest] = groupCommentThreads(comments, [{ id: 'T1', rootCommentId: 1, resolved: true }], ['b.ts'])
    expect(rest).toEqual([])
    expect(thread).toMatchObject({ rootId: 1, threadId: 'T1', resolved: true })
    expect(thread?.comments.map((comment) => comment.id)).toEqual([1, 2, 3])
  })

  it('orders threads like the file list, then by line, outdated last', () => {
    const comments = [
      makeComment(1, { path: 'b.ts', line: 5 }),
      makeComment(2, { path: 'a.ts', line: null, outdated: true }),
      makeComment(3, { path: 'a.ts', line: 7 }),
    ]
    expect(groupCommentThreads(comments, [], ['a.ts', 'b.ts']).map((thread) => thread.rootId)).toEqual([3, 2, 1])
  })

  it('marks comments on the whole file, which have no line and are not outdated', () => {
    const [thread] = groupCommentThreads([makeComment(5, { line: null, subjectType: 'file' })], [], ['b.ts'])
    expect(thread).toMatchObject({ onFile: true, outdated: false, line: null })
  })

  it('keeps a reply whose first comment is missing as its own thread, unresolved when status is unknown', () => {
    const [thread] = groupCommentThreads([makeComment(4, { inReplyTo: 99 })], [], ['b.ts'])
    expect(thread).toMatchObject({ rootId: 4, threadId: null, resolved: false })
  })
})

describe('indexFileComments', () => {
  const makeDraft = (id: string, over: Partial<DraftComment> = {}): DraftComment => ({
    id,
    path: 'b.ts',
    side: 'RIGHT',
    line: 10,
    body: id,
    ...over,
  })

  it('files threads under their line, on the file, or as outdated', () => {
    const comments = [
      makeComment(1),
      makeComment(2, { inReplyTo: 1 }),
      makeComment(3, { line: null, subjectType: 'file' }),
      makeComment(4, { line: null, outdated: true }),
      makeComment(5, { line: null, outdated: true, inReplyTo: 4 }),
    ]
    const index = indexFileComments('b.ts', comments, [])
    expect(
      index.threadsByLine.get('RIGHT:10')?.map((threadComments) => threadComments.map((comment) => comment.id)),
    ).toEqual([[1, 2]])
    expect(index.fileThreads.map((thread) => thread[0]?.id)).toEqual([3])
    expect(index.outdatedThreads.map((thread) => thread.map((comment) => comment.id))).toEqual([[4, 5]])
  })

  it('keys new line drafts and leaves out replies and file drafts', () => {
    const index = indexFileComments(
      'b.ts',
      [],
      [
        makeDraft('a'),
        makeDraft('b', { side: 'LEFT', line: 3 }),
        makeDraft('r', { inReplyTo: 1 }),
        makeDraft('f', { line: null }),
      ],
    )
    expect([...index.draftsByLine].map(([anchor, ds]) => [anchor, ds.map((draftAtLine) => draftAtLine.id)])).toEqual([
      ['RIGHT:10', ['a']],
      ['LEFT:3', ['b']],
    ])
  })
})

describe('searching comments', () => {
  const threads = groupCommentThreads(
    [
      makeComment(1, { body: 'Please add a Retry here' }),
      makeComment(2, { inReplyTo: 1, author: 'cy', body: 'done' }),
      makeComment(3, { path: 'a.ts', body: 'naming' }),
    ],
    [],
    ['a.ts', 'b.ts'],
  )

  it('matches comment text, authors and paths, ignoring case', () => {
    expect(searchThreads(threads, 'retry').map((thread) => thread.rootId)).toEqual([1])
    expect(searchThreads(threads, 'CY').map((thread) => thread.rootId)).toEqual([1])
    expect(searchThreads(threads, 'a.ts').map((thread) => thread.rootId)).toEqual([3])
    expect(searchThreads(threads, '  ')).toHaveLength(2)
    expect(searchThreads(threads, 'nothing')).toEqual([])
  })

  it('names the comment that matched', () => {
    expect(findMatchingComment(assertPresent(threads[1]), 'done')?.id).toBe(2)
  })

  it('searches drafts by text and path', () => {
    const drafts: DraftComment[] = [{ id: 'd', path: 'src/x.ts', side: 'RIGHT', line: 1, body: 'typo' }]
    expect(searchDrafts(drafts, 'TYPO')).toHaveLength(1)
    expect(searchDrafts(drafts, 'x.ts')).toHaveLength(1)
    expect(searchDrafts(drafts, 'zzz')).toEqual([])
  })
})

describe('newComments', () => {
  const thread = assertPresent(
    groupCommentThreads(
      [
        makeComment(1, { author: 'me' }),
        makeComment(2, { inReplyTo: 1, author: 'bo' }),
        makeComment(4, { inReplyTo: 1, author: 'me' }),
        makeComment(5, { inReplyTo: 1, author: 'bo' }),
      ],
      [],
      ['b.ts'],
    )[0],
  )

  it("lists others' comments after your last review", () => {
    const fresh = findNewComments(thread, { viewer: 'me', since: '2026-11-03T00:00:00Z' })
    expect(fresh.map((comment) => comment.id)).toEqual([5])
  })

  it('leaves out your own comments', () => {
    const fresh = findNewComments(thread, { viewer: 'me', since: '2026-11-01T12:00:00Z' })
    expect(fresh.map((comment) => comment.id)).toEqual([2, 5])
  })

  it('is empty before your first review', () => {
    expect(findNewComments(thread, { viewer: 'me', since: null })).toEqual([])
  })
})

describe('commentedLines', () => {
  it('covers every line of a range comment and the line of a single-line one', () => {
    const lines = collectCommentedLines(
      [makeComment(1, { line: 12, startLine: 10 }), makeComment(2, { line: 3, side: 'LEFT' })],
      [],
    )
    expect(lines).toEqual(new Set(['LEFT:3', 'RIGHT:10', 'RIGHT:11', 'RIGHT:12']))
  })

  it('includes your pending comments but not replies, outdated or file comments', () => {
    const lines = collectCommentedLines(
      [makeComment(1, { outdated: true, line: null }), makeComment(2, { subjectType: 'file', line: null })],
      [
        { id: 'd1', path: 'b.ts', side: 'RIGHT', line: 21, startLine: 20, body: 'x' },
        { id: 'd2', path: 'b.ts', side: 'RIGHT', line: 40, body: 'reply', inReplyTo: 7 },
        { id: 'd3', path: 'b.ts', side: 'RIGHT', line: null, body: 'on the file' },
      ],
    )
    expect(lines).toEqual(new Set(['RIGHT:20', 'RIGHT:21']))
  })
})

describe('searchConversation', () => {
  const makeEntry = (author: string, body: string): ConversationComment => ({
    id: `comment-${author}`,
    kind: 'comment',
    author,
    authorAvatar: '',
    body,
    url: '',
    createdAt: '',
  })
  const conversation = [makeEntry('ana', 'Can we ship this today?'), makeEntry('bo', 'Rebased on main')]

  it('matches the text or the author, ignoring case', () => {
    expect(searchConversation(conversation, 'SHIP').map((comment) => comment.author)).toEqual(['ana'])
    expect(searchConversation(conversation, 'bo').map((comment) => comment.author)).toEqual(['bo'])
    expect(searchConversation(conversation, '  ')).toHaveLength(2)
  })
})
