import { describe, expect, it } from 'vitest'
import { addOffsets, numberLines } from './numbered-lines.util.ts'

describe('numberLines', () => {
  it('numbers lines from 1, keeping empty ones', () => {
    expect(numberLines('a\n\nb')).toEqual([
      { number: 1, text: 'a' },
      { number: 2, text: '' },
      { number: 3, text: 'b' },
    ])
  })
})

describe('withOffsets', () => {
  it('places each piece where the previous ones end', () => {
    expect(addOffsets([{ text: 'ab' }, { text: '' }, { text: 'c' }]).map((piece) => piece.offset)).toEqual([0, 2, 2])
  })
})
