import { describe, expect, it } from 'vitest'
import { excerpt, excerptAround } from '@shared/excerpt'

describe('excerpt', () => {
  it('names code and suggestions and flattens markdown', () => {
    expect(excerpt('**Nit:** use this\n```suggestion\nx\n```\nand `y`')).toBe('Nit: use this [suggested change] and y')
  })
})

describe('excerptAround', () => {
  it('starts at the beginning when the mention is early', () => {
    expect(excerptAround('@me look at this', 'me', 50)).toBe('@me look at this')
  })

  it('jumps to the mention in a long comment', () => {
    const body = `${'word '.repeat(100)}cc @Me please check`
    const out = excerptAround(body, 'me', 60)
    expect(out.startsWith('…')).toBe(true)
    expect(out).toContain('@Me please check')
  })
})
