import { describe, expect, it } from 'vitest'
import {
  type RawThread,
  type RawThreadComment,
  type RawThreadPr,
  triageThread,
  triageThreads,
} from './thread-triage.util.ts'

const user = (login: string) => ({ __typename: 'User', login, avatarUrl: '' })
const bot = (login: string) => ({ __typename: 'Bot', login, avatarUrl: '' })
const comment = (author: ReturnType<typeof user> | null, createdAt: string): RawThreadComment => ({
  author,
  body: `${author?.login} says`,
  createdAt,
  url: '',
})

function makeThread(comments: RawThreadComment[], over: Partial<RawThread> = {}): RawThread {
  return {
    id: `T${comments.length}`,
    isResolved: false,
    isOutdated: false,
    path: 'src/a.ts',
    line: 12,
    comments: { totalCount: comments.length, nodes: comments },
    ...over,
  }
}

function makePr(author: string, threads: RawThread[]): RawThreadPr {
  return {
    number: 7,
    title: 'Add thing',
    url: '',
    isDraft: false,
    repository: { nameWithOwner: 'acme/web' },
    author: user(author),
    reviewThreads: { nodes: threads },
  }
}

describe('triageThread', () => {
  it('on your PR, a reviewer comment waits on you', () => {
    const t = makeThread([comment(user('bo'), 't1')])
    expect(triageThread(t, makePr('me', [t]), 'me')).toMatchObject({
      waitingOn: 'you',
      lastActivityAt: 't1',
      prAuthor: 'me',
      path: 'src/a.ts',
      line: 12,
    })
  })

  it('your comment with no answer waits on others', () => {
    const t = makeThread([comment(user('bo'), 't1'), comment(user('me'), 't2')])
    expect(triageThread(t, makePr('bo', [t]), 'me')?.waitingOn).toBe('others')
  })

  it('an answer to your comment on someone else’s PR waits on you', () => {
    const t = makeThread([comment(user('me'), 't1'), comment(user('bo'), 't2')])
    expect(triageThread(t, makePr('bo', [t]), 'me')?.waitingOn).toBe('you')
  })

  it('skips resolved threads and threads you are not part of', () => {
    const resolved = makeThread([comment(user('bo'), 't1')], { isResolved: true })
    const notYours = makeThread([comment(user('bo'), 't1'), comment(user('cy'), 't2')])
    expect(triageThread(resolved, makePr('me', [resolved]), 'me')).toBeNull()
    expect(triageThread(notYours, makePr('bo', [notYours]), 'me')).toBeNull()
  })

  it('flags bots and drops the line of outdated threads', () => {
    const t = makeThread([comment(bot('coderabbitai'), 't1')], { isOutdated: true })
    const out = triageThread(t, makePr('me', [t]), 'me')
    expect(out?.comments[0]?.bot).toBe(true)
    expect(out).toMatchObject({ outdated: true, line: null })
  })

  it('treats deleted accounts as someone else', () => {
    const t = makeThread([comment(user('me'), 't1'), comment(null, 't2')])
    expect(triageThread(t, makePr('bo', [t]), 'me')).toMatchObject({
      waitingOn: 'you',
      comments: [{ author: 'me' }, { author: 'ghost' }],
    })
  })
})

describe('triageThreads', () => {
  it('lists threads across PRs, longest waiting first', () => {
    const recent = makeThread([comment(user('bo'), '2026-11-15')], { id: 'recent' })
    const old = makeThread([comment(user('bo'), '2026-11-01')], { id: 'old' })
    expect(triageThreads([makePr('me', [recent, null as never]), makePr('me', [old])], 'me').map((t) => t.id)).toEqual([
      'old',
      'recent',
    ])
  })
})
