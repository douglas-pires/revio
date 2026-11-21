import type { ReviewComment } from '@shared/pull.types.ts'
import { describe, expect, it } from 'vitest'
import type { CommentThread } from './comment-threads.util.ts'
import {
  countMatchesShown,
  describeEmptyList,
  filterVisibleThreads,
  hasYourComment,
  keepYourThreads,
  readNewSideLine,
} from './comments-panel.util.ts'

const REVIEWED = { viewer: 'me', since: '2026-11-20T10:00:00Z' }

const makeComment = (author: string, createdAt: string, body = 'text'): ReviewComment => ({
  id: Number(createdAt.replaceAll(/\D/gu, '')),
  nodeId: 'node',
  inReplyTo: undefined,
  path: 'a.ts',
  line: 1,
  startLine: null,
  side: 'RIGHT',
  body,
  author,
  authorAvatar: '',
  createdAt,
  url: '',
  outdated: false,
  subjectType: 'line',
  reactions: [],
})

const makeThread = (rootId: number, resolved: boolean, ...comments: ReviewComment[]): CommentThread => ({
  rootId,
  threadId: null,
  path: 'a.ts',
  line: 1,
  side: 'RIGHT',
  outdated: false,
  onFile: false,
  resolved,
  comments,
})

const open = makeThread(1, false, makeComment('bo', '2026-11-20T09:00:00Z', 'retry this'))
const settled = makeThread(2, true, makeComment('me', '2026-11-20T08:00:00Z'))
const resolvedWithReply = makeThread(
  3,
  true,
  makeComment('me', '2026-11-20T08:00:00Z'),
  makeComment('bo', '2026-11-20T11:00:00Z', 'fixed'),
)
const threads = [open, settled, resolvedWithReply]
const idsOf = (shown: readonly CommentThread[]) => shown.map((thread) => thread.rootId)

describe('filterVisibleThreads', () => {
  it('hides resolved threads with nothing new, unless asked to show them', () => {
    expect(idsOf(filterVisibleThreads(threads, '', false, REVIEWED))).toEqual([1, 3])
    expect(idsOf(filterVisibleThreads(threads, '', true, REVIEWED))).toEqual([1, 2, 3])
  })

  it('searches every thread, resolved ones included', () => {
    expect(idsOf(filterVisibleThreads(threads, 'fixed', false, REVIEWED))).toEqual([3])
  })
})

describe('keepYourThreads', () => {
  it('keeps the threads you commented in only when asked', () => {
    expect(hasYourComment(open, 'me')).toBe(false)
    expect(idsOf(keepYourThreads(threads, true, 'me'))).toEqual([2, 3])
    expect(idsOf(keepYourThreads(threads, false, 'me'))).toEqual([1, 2, 3])
  })
})

describe('small panel helpers', () => {
  it('jumps only to new-side lines', () => {
    expect(readNewSideLine('RIGHT', 4)).toBe(4)
    expect(readNewSideLine('LEFT', 4)).toBeNull()
  })

  it('counts matches only while searching', () => {
    expect(countMatchesShown(true, 3)).toBe(3)
    expect(countMatchesShown(false, 3)).toBeNull()
  })

  it('explains an empty list', () => {
    expect(describeEmptyList('', 2, true)).toBe('You have no comments on this PR yet.')
    expect(describeEmptyList(' zz ', 2, false)).toBe('No comment mentions “zz”.')
    expect(describeEmptyList('', 2, false)).toBe('Every thread is resolved.')
    expect(describeEmptyList('', 0, false)).toBe('No review comments yet.')
  })
})
