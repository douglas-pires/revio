import { describe, expect, it } from 'vitest'
import { describeVerdict } from './verdict-label.util.ts'

describe('describeVerdict', () => {
  it('names who gave the verdict, folding past two names', () => {
    expect(describeVerdict('approved', ['ana'])).toBe('approved by ana')
    expect(describeVerdict('approved', ['ana', 'bo'])).toBe('approved by ana, bo')
    expect(describeVerdict('approved', ['ana', 'bo', 'cy', 'di'])).toBe('approved by ana, bo +2')
  })

  it('is just the verdict when nobody is named', () => {
    expect(describeVerdict('changes requested', [])).toBe('changes requested')
  })
})
