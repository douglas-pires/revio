import { describe, expect, it } from 'vitest'
import { quoteReply } from './quote.util.ts'

describe('quoteReply', () => {
  it('quotes the first paragraph and addresses the author', () => {
    expect(quoteReply('Can you check this?\nIt looks off.\n\nAlso unrelated.', 'ana')).toBe(
      '> Can you check this?\n> It looks off.\n\n@ana ',
    )
  })

  it('clips a long paragraph', () => {
    expect(quoteReply('abcdefghij', 'bo', 4)).toBe('> abcd…\n\n@bo ')
  })

  it('keeps blank quoted lines clean', () => {
    expect(quoteReply('one\n \ntwo', 'cy')).toBe('> one\n\n@cy ')
  })
})
