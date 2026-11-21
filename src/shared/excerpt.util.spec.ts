import { excerptAround, summarizeAround, summarizeComment } from '@shared/excerpt.util.ts'
import { describe, expect, it } from 'vitest'

describe('summarizeComment', () => {
  it('names code and suggestions and flattens markdown', () => {
    expect(summarizeComment('**Nit:** use this\n```suggestion\nx\n```\nand `y`')).toBe(
      'Nit: use this [suggested change] and y',
    )
  })
})

describe('summarizeComment with HTML and links', () => {
  it('decodes entities after dropping tags, so encoded markup stays text', () => {
    expect(summarizeComment('✅&nbsp;&nbsp;Linked to Story &amp; <b>done</b> &lt;b&gt; &#39;ok&#39; &#x1F600;')).toBe(
      "✅ Linked to Story & done <b> 'ok' 😀",
    )
  })

  it('drops quote and heading markers only at the start of a line', () => {
    expect(summarizeComment('> quoted\n## Title\nkeep a > b and #12')).toBe('quoted Title keep a > b and #12')
  })

  it('keeps unknown entity names as written', () => {
    expect(summarizeComment('a &bogus; b')).toBe('a &bogus; b')
  })

  it('shows links as their text and images as their alt text', () => {
    expect(summarizeComment('See [the spike](https://x.dev/spike) ![risk: high](https://img/badge.svg)')).toBe(
      'See the spike risk: high',
    )
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
