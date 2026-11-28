import { describe, expect, it } from 'vitest'
import { buildPermalink, MAX_PERMALINK_LINES, parsePermalink, sliceLines } from './permalink.util.ts'

const SHA = '4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39'

describe('parsePermalink', () => {
  it('reads one line and a range', () => {
    expect(parsePermalink(`https://github.com/acme/web/blob/${SHA}/src/cart.ts#L12`)).toEqual({
      repo: 'acme/web',
      ref: SHA,
      path: 'src/cart.ts',
      start: 12,
      end: 12,
    })
    expect(parsePermalink(`https://github.com/acme/web/blob/main/src/a%20b.ts#L20-L10`)).toMatchObject({
      ref: 'main',
      path: 'src/a b.ts',
      start: 10,
      end: 20,
    })
  })

  it('leaves other links alone', () => {
    expect(parsePermalink(`https://github.com/acme/web/blob/${SHA}/src/cart.ts`)).toBeNull()
    expect(parsePermalink('https://github.com/acme/web/pull/12')).toBeNull()
    expect(parsePermalink('https://example.com/acme/web/blob/main/a.ts#L1')).toBeNull()
  })
})

describe('sliceLines', () => {
  const link = { repo: 'acme/web', ref: SHA, path: 'a.ts', start: 2, end: 3 }

  it('takes the named lines', () => {
    expect(sliceLines('one\ntwo\nthree\nfour', link)).toEqual({ code: 'two\nthree', cut: false })
  })

  it('cuts a long range, and gives up when the file is shorter', () => {
    const long = Array.from({ length: 200 }, (_, index) => `line ${index + 1}`).join('\n')
    const sliced = sliceLines(long, { ...link, start: 1, end: 200 })
    expect(sliced?.code.split('\n')).toHaveLength(MAX_PERMALINK_LINES)
    expect(sliced?.cut).toBe(true)
    expect(sliceLines('one', link)).toBeNull()
  })
})

describe('buildPermalink', () => {
  it('points at lines of a file at a commit', () => {
    const pullUrl = 'https://github.com/acme/web/pull/7'
    expect(buildPermalink(pullUrl, SHA, 'src/a b.ts', { start: 4, end: 9 })).toBe(
      `https://github.com/acme/web/blob/${SHA}/src/a%20b.ts#L4-L9`,
    )
    expect(buildPermalink(pullUrl, SHA, 'src/a.ts', { start: 4, end: 4 })).toBe(
      `https://github.com/acme/web/blob/${SHA}/src/a.ts#L4`,
    )
    expect(buildPermalink(pullUrl, SHA, 'src/a.ts', null)).toBe(`https://github.com/acme/web/blob/${SHA}/src/a.ts`)
  })
})
