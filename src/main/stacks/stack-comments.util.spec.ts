import { describe, expect, it } from 'vitest'
import { type RawStackThread, summarizeYourThreads } from './stack-comments.util.ts'

/** A comment by `login`, or a missing one (null) as GitHub returns for some deleted comments. */
function commentBy(login: string | null) {
  if (login === null) {
    return null
  }
  return { author: { login } }
}

const makeThread = (authors: (string | null)[], isResolved = false): RawStackThread => ({
  isResolved,
  comments: { nodes: authors.map(commentBy) },
})
const PR = { repo: 'acme/web', number: 7 }

describe('summarizeYourThreads', () => {
  it('counts the threads you commented in', () => {
    const summary = summarizeYourThreads(PR, [makeThread(['me']), makeThread(['bo', 'me']), makeThread(['bo'])], 'me')
    expect(summary).toEqual({ repo: 'acme/web', number: 7, yourThreads: 2, awaitingYou: 0 })
  })

  it('marks open threads where someone answered after you as waiting on you', () => {
    const summary = summarizeYourThreads(
      PR,
      [makeThread(['me', 'bo']), makeThread(['me', 'bo'], true), makeThread(['bo', 'me', 'bo'])],
      'me',
    )
    expect(summary.yourThreads).toBe(3)
    expect(summary.awaitingYou).toBe(2)
  })

  it('skips missing threads and comments by deleted accounts', () => {
    const summary = summarizeYourThreads(PR, [null, makeThread(['me', null])], 'me')
    expect(summary).toEqual({ repo: 'acme/web', number: 7, yourThreads: 1, awaitingYou: 1 })
  })
})
