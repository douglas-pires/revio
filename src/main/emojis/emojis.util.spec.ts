import { describe, expect, it } from 'vitest'
import { parseEmojis } from './emojis.util.ts'

const picture = (file: string) => `https://github.githubassets.com/images/icons/emoji/${file}.png?v8`
const readText = (name: string, file: string) => parseEmojis({ [name]: picture(file) })[0]?.text

describe('parseEmojis', () => {
  it('keeps the name and the picture', () => {
    expect(parseEmojis({ smile: picture('unicode/1f604') })).toEqual([
      { name: 'smile', text: '😄', imageUrl: picture('unicode/1f604') },
    ])
  })

  it('writes the character, asking for the emoji where it would be drawn as text', () => {
    expect(readText('+1', 'unicode/1f44d')).toBe('👍')
    expect(readText('heart', 'unicode/2764')).toBe('❤️')
    expect(readText('us', 'unicode/1f1fa-1f1f8')).toBe('🇺🇸')
  })

  it('writes the name where the character cannot be rebuilt, or there is none', () => {
    expect(readText('rainbow_flag', 'unicode/1f3f3-1f308')).toBe(':rainbow_flag:')
    expect(readText('one', 'unicode/0031-20e3')).toBe(':one:')
    expect(readText('octocat', 'octocat')).toBe(':octocat:')
  })
})
