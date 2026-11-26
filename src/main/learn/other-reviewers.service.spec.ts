import { describe, expect, it } from 'vitest'
import { buildThemesPrompt } from './other-reviewers.service.ts'

describe('buildThemesPrompt', () => {
  it('lists each point with its file, but not who raised it', () => {
    const prompt = buildThemesPrompt([
      { author: 'ana', path: 'cart.ts', line: 3, body: 'Handle the empty cart', url: 'https://x' },
    ])
    expect(prompt).toContain('<point file="cart.ts">\nHandle the empty cart\n</point>')
    expect(prompt).not.toContain('ana')
  })
})
