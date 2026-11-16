import { describe, expect, it } from 'vitest'
import type { OpenThread, ThreadComment } from '@shared/thread.types'
import { applyReply, countWaitingOnYou, setMembership } from '@/threads/thread-edits.util'

const makeComment = (author: string, createdAt: string): ThreadComment => ({ author, authorAvatar: '', bot: false, body: 'hi', createdAt, url: '' })
const makeThread = (id: string, waitingOn: OpenThread['waitingOn']): OpenThread => ({
  id, repo: 'acme/web', number: 1, prTitle: '', prUrl: '', prAuthor: 'me', isDraft: false, path: 'a.ts', line: 1, outdated: false,
  comments: [makeComment('bo', 't1')], totalComments: 1, waitingOn, lastActivityAt: 't1',
})

describe('applyReply', () => {
  it('appends your reply and moves the thread to waiting on others', () => {
    const [a, b] = applyReply([makeThread('a', 'you'), makeThread('b', 'you')], 'a', makeComment('me', 't2'))
    expect(a).toMatchObject({ waitingOn: 'others', totalComments: 2, lastActivityAt: 't2' })
    expect(a!.comments.map((c) => c.author)).toEqual(['bo', 'me'])
    expect(b).toMatchObject({ waitingOn: 'you', totalComments: 1 })
  })
})

describe('countWaitingOnYou', () => {
  it('leaves out threads resolved in this session', () => {
    const threads = [makeThread('a', 'you'), makeThread('b', 'you'), makeThread('c', 'others')]
    expect(countWaitingOnYou(threads, new Set(['b']))).toBe(1)
  })
})

describe('setMembership', () => {
  it('adds and removes without touching the original', () => {
    const start = new Set(['a'])
    expect([...setMembership(start, 'b', true)]).toEqual(['a', 'b'])
    expect([...setMembership(start, 'a', false)]).toEqual([])
    expect([...start]).toEqual(['a'])
  })
})
