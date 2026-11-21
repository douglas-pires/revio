import { describe, expect, it } from 'vitest'
import { buildMarkdownLink } from '@/common/markdown-link.util.ts'

describe('markdownLinkFor', () => {
  it('turns a link pasted over words into a markdown link', () => {
    expect(buildMarkdownLink('the RFC', 'https://example.com/rfc/9110')).toBe('[the RFC](https://example.com/rfc/9110)')
  })

  it('ignores spaces around the pasted link', () => {
    expect(buildMarkdownLink('docs', '  https://example.com/docs\n')).toBe('[docs](https://example.com/docs)')
  })

  it('escapes brackets in the words', () => {
    expect(buildMarkdownLink('see [1]', 'https://example.com')).toBe(String.raw`[see \[1\]](https://example.com)`)
  })

  it('leaves the paste alone when nothing is selected', () => {
    expect(buildMarkdownLink('', 'https://example.com')).toBeNull()
    expect(buildMarkdownLink('  ', 'https://example.com')).toBeNull()
  })

  it('leaves the paste alone when it is not a single link', () => {
    expect(buildMarkdownLink('docs', 'not a link')).toBeNull()
    expect(buildMarkdownLink('docs', 'https://a.com https://b.com')).toBeNull()
    expect(buildMarkdownLink('docs', 'javascript:alert(1)')).toBeNull()
    expect(buildMarkdownLink('docs', 'src/index.ts')).toBeNull()
  })

  it('replaces a selected link rather than wrapping it', () => {
    expect(buildMarkdownLink('https://old.example.com', 'https://new.example.com')).toBeNull()
  })
})
