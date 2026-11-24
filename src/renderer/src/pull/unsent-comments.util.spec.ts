import { afterEach, describe, expect, it } from 'vitest'
import {
  forgetUnsentComment,
  keepUnsentComment,
  listUnsentLineComments,
  listUnsentPaths,
  publishUnsentComments,
  readUnsentComment,
  type UnsentPlace,
} from './unsent-comments.util.ts'

const SCOPE = 'acme/payments#1'
const KEY = `${SCOPE}:line:a.ts:RIGHT:3`
const PLACE: UnsentPlace = { scope: SCOPE, path: 'a.ts', selection: { side: 'RIGHT', start: 2, end: 3 } }

const keep = (body: string, initial = '') => keepUnsentComment(KEY, { body, place: PLACE }, initial)

afterEach(() => forgetUnsentComment(KEY))

describe('unsent comments', () => {
  it('keeps the latest text, for that box only', () => {
    keep('half')
    keep('half a thought')
    expect(readUnsentComment(KEY)).toBe('half a thought')
    expect(readUnsentComment('acme/payments#2:line:a.ts:RIGHT:3')).toBeUndefined()
  })

  it('keeps nothing when the box is empty or still holds what it opened with', () => {
    keep('something')
    keep('  \n')
    expect(readUnsentComment(KEY)).toBeUndefined()
    keep('> quoted\n\n', '> quoted\n\n')
    expect(readUnsentComment(KEY)).toBeUndefined()
  })
})

describe('the places with something unsent', () => {
  it('show once the box closes, with the lines it was on', () => {
    keep('half a thought')
    expect(listUnsentLineComments(SCOPE, 'a.ts')).toEqual([])
    publishUnsentComments()
    expect(listUnsentLineComments(SCOPE, 'a.ts')).toEqual([
      { key: KEY, body: 'half a thought', selection: { side: 'RIGHT', start: 2, end: 3 } },
    ])
    expect(listUnsentPaths(SCOPE)).toEqual(new Set(['a.ts']))
  })

  it('belong to one file of one PR', () => {
    keep('half a thought')
    publishUnsentComments()
    expect(listUnsentLineComments(SCOPE, 'b.ts')).toEqual([])
    expect(listUnsentPaths('acme/payments#2')).toEqual(new Set())
  })

  it('are gone once the text is sent or thrown away', () => {
    keep('half a thought')
    publishUnsentComments()
    forgetUnsentComment(KEY)
    expect(listUnsentLineComments(SCOPE, 'a.ts')).toEqual([])
  })
})
