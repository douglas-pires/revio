import { describe, expect, it } from 'vitest'
import { forgetUnsentComment, keepUnsentComment, readUnsentComment } from './unsent-comments.util.ts'

describe('unsent comments', () => {
  it('keeps what you typed for that box only', () => {
    keepUnsentComment('acme/payments#1:line:a.ts:RIGHT:3', 'half a thought', '')
    expect(readUnsentComment('acme/payments#1:line:a.ts:RIGHT:3')).toBe('half a thought')
    expect(readUnsentComment('acme/payments#2:line:a.ts:RIGHT:3')).toBeUndefined()
  })

  it('keeps the latest text as you type', () => {
    keepUnsentComment('k-latest', 'a', '')
    keepUnsentComment('k-latest', 'ab', '')
    expect(readUnsentComment('k-latest')).toBe('ab')
  })

  it('keeps nothing when the box is empty or still holds what it opened with', () => {
    keepUnsentComment('k-empty', 'something', '')
    keepUnsentComment('k-empty', '  \n', '')
    expect(readUnsentComment('k-empty')).toBeUndefined()
    keepUnsentComment('k-quote', '> quoted\n\n', '> quoted\n\n')
    expect(readUnsentComment('k-quote')).toBeUndefined()
  })

  it('forgets on Cancel or send', () => {
    keepUnsentComment('k-forget', 'draft', '')
    forgetUnsentComment('k-forget')
    expect(readUnsentComment('k-forget')).toBeUndefined()
  })
})
