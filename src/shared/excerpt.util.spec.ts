import { describe, expect, it } from 'vitest'
import { excerptAround, summarizeComment, summarizeAround } from '@shared/excerpt.util'

describe('summarizeComment', () => {
  it('names code and suggestions and flattens markdown', () => {
    expect(summarizeComment('**Nit:** use this\n```suggestion\nx\n```\nand `y`')).toBe('Nit: use this [suggested change] and y')
  })
})

describe('summarizeAround', () => {
  it('starts at the beginning when the mention is early', () => {
    expect(summarizeAround('@me look at this', 'me', 50)).toBe('@me look at this')
  })

  it('jumps to the mention in a long comment', () => {
    const body = `${'word '.repeat(100)}cc @Me please check`
    const out = summarizeAround(body, 'me', 60)
    expect(out.startsWith('…')).toBe(true)
    expect(out).toContain('@Me please check')
  })
})

describe('excerptAround', () => {
  it('centres a late match and starts from the top when there is none', () => {
    const body = `${'word '.repeat(100)}the Retry loop here`
    expect(excerptAround(body, 'retry', 60)).toContain('Retry loop')
    expect(excerptAround(body, 'absent', 10)).toBe('word word ')
  })
})
