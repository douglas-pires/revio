import type { RaisedPoint } from '@shared/learn.types.ts'
import { describe, expect, it } from 'vitest'
import { compareReviewers, type PullPoints } from './compare-reviewers.util.ts'

const point = (author: string, path: string, line: number | null, body = ''): RaisedPoint => ({
  author,
  path,
  line,
  body,
  url: `https://github.com/acme/web/pull/1#${author}${line}`,
})

const pullWith = (points: RaisedPoint[]): PullPoints => ({
  repo: 'acme/web',
  number: 1,
  title: 'feat: cart',
  url: 'https://github.com/acme/web/pull/1',
  author: 'bo',
  points,
})

describe('compareReviewers', () => {
  it('splits points into theirs only, yours only and both, by file and nearby line', () => {
    const [review] = compareReviewers('me', [
      pullWith([
        point('me', 'cart.ts', 10),
        point('ana', 'cart.ts', 13),
        point('ana', 'cart.ts', 40, 'Off by one'),
        point('me', 'total.ts', 5),
        point('lee', 'cart.ts', null, 'Split this file'),
      ]),
    ])
    expect(review?.theyRaised.map((raised) => raised.body)).toEqual(['Off by one', 'Split this file'])
    expect(review?.reviewers).toEqual(['ana', 'lee'])
    expect([review?.onlyYou, review?.both]).toEqual([1, 1])
  })

  it('leaves out the PR’s author, bots, and PRs nobody else reviewed', () => {
    const pulls = [pullWith([point('me', 'a.ts', 1), point('bo', 'a.ts', 9), point('renovate[bot]', 'a.ts', 20)])]
    expect(compareReviewers('me', pulls)).toEqual([])
  })
})
