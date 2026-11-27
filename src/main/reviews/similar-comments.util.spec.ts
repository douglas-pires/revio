import type { PastReview } from '@shared/review-history.types.ts'
import { describe, expect, it } from 'vitest'
import { findSimilarComments, readTellingWords } from './similar-comments.util.ts'

function review(number: number, bodies: string[]): PastReview {
  return {
    repo: 'acme/web',
    number,
    title: `PR ${number}`,
    url: `https://github.com/acme/web/pull/${number}`,
    state: 'COMMENTED',
    submittedAt: '2026-10-01T00:00:00Z',
    comments: bodies.map((body, index) => ({
      body,
      path: 'src/app.ts',
      url: `https://github.com/acme/web/pull/${number}#c${index}`,
      createdAt: `2026-10-0${index + 1}T00:00:00Z`,
    })),
  }
}

describe('readTellingWords', () => {
  it('leaves out code, links, mentions and filler words', () => {
    const words = readTellingWords('@ana please wrap `fetchUser` in a try block, see https://x.dev/a ```ts\nfoo()\n```')
    expect(words).toEqual(new Set(['wrap', 'try', 'block', 'see']))
  })
})

describe('findSimilarComments', () => {
  const history = [
    review(12, ['Please handle the error when the request fails, the user sees a blank page otherwise']),
    review(40, ['Handle the request error here too, otherwise a blank page shows', 'Nice naming!']),
    review(41, ['Rename this variable to something the reader understands']),
  ]

  it('finds earlier comments saying the same thing in other words, closest first', () => {
    const found = findSimilarComments(
      'We should handle the error if this request fails, or a blank page shows',
      history,
    )
    expect(found.map((comment) => comment.number)).toEqual([40, 12])
  })

  it('ignores comments too short to judge', () => {
    expect(findSimilarComments('Nice naming!', history)).toEqual([])
  })

  it('finds nothing when no comment is close enough', () => {
    expect(findSimilarComments('This migration needs a down step for rollbacks', history)).toEqual([])
  })
})
