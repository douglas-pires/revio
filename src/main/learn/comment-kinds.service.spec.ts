import { describe, expect, it } from 'vitest'
import { buildSortPrompt } from './comment-kinds.service.ts'

describe('buildSortPrompt', () => {
  it('numbers the comments so the answer can point back to them', () => {
    const prompt = buildSortPrompt([
      { url: 'a', path: 'cart.ts', body: 'Rename this' },
      { url: 'b', path: 'total.ts', body: 'Handle the error' },
    ])
    expect(prompt).toContain('<comment index="0" file="cart.ts">\nRename this\n</comment>')
    expect(prompt).toContain('<comment index="1" file="total.ts">')
  })
})
