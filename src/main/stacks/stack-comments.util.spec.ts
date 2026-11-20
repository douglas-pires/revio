import { describe, expect, it } from 'vitest'
import { type RawStackThread, summarizeStackPr } from './stack-comments.util.ts'

/** A comment by `login`, or a missing one (null) as GitHub returns for some deleted comments. */
function commentBy(login: string | null) {
  if (login === null) {
    return null
  }
  return { author: { login } }
}

const thread = (authors: (string | null)[], isResolved = false): RawStackThread => ({
  isResolved,
  comments: { nodes: authors.map(commentBy) },
})
const PR = { repo: 'acme/web', number: 7 }

describe('summarizeStackPr', () => {
  it('counts the threads you commented in', () => {
    const s = summarizeStackPr(PR, [thread(['me']), thread(['bo', 'me']), thread(['bo'])], 'me')
    expect(s).toEqual({ repo: 'acme/web', number: 7, yourThreads: 2, awaitingYou: 0 })
  })

  it('marks open threads where someone answered after you as waiting on you', () => {
    const s = summarizeStackPr(PR, [thread(['me', 'bo']), thread(['me', 'bo'], true), thread(['bo', 'me', 'bo'])], 'me')
    expect(s.yourThreads).toBe(3)
    expect(s.awaitingYou).toBe(2)
  })

  it('skips missing threads and comments by deleted accounts', () => {
    const s = summarizeStackPr(PR, [null, thread(['me', null])], 'me')
    expect(s).toEqual({ repo: 'acme/web', number: 7, yourThreads: 1, awaitingYou: 1 })
  })
})
