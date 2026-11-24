import { describe, expect, it } from 'vitest'
import { suggestEmojis } from './emoji-suggestions.util.ts'

const emojis = ['smirk', 'heart_eyes', 'heart', 'tada', 'smile', '+1'].map((name) => ({
  name,
  text: name,
  imageUrl: '',
}))
const suggestNames = (query: string) => suggestEmojis(emojis, query).map(({ name }) => name)

describe('suggestEmojis', () => {
  it('suggests the usual ones before you type a name', () => {
    expect(suggestNames('')).toEqual(['+1', 'heart', 'tada', 'smile'])
  })

  it('puts the whole name first, then names that only start with it', () => {
    expect(suggestNames('heart')).toEqual(['heart', 'heart_eyes'])
    expect(suggestNames('sml')).toContain('smile')
    expect(suggestNames('zzz')).toEqual([])
  })
})
