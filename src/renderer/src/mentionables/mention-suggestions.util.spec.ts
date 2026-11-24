import { describe, expect, it } from 'vitest'
import { suggestMentionables } from './mention-suggestions.util.ts'

const mentionable = (handle: string, name: string | null = null) => ({ handle, name, avatarUrl: '' })
const everyone = [mentionable('ana'), mentionable('bo', 'Robert Lee'), mentionable('cy'), mentionable('acme/web')]
const suggestHandles = (query: string) =>
  suggestMentionables(everyone, new Set(['cy']), query).map(({ handle }) => handle)

describe('suggestMentionables', () => {
  it('starts with those in the PR', () => {
    expect(suggestHandles('')).toEqual(['cy', 'ana', 'bo', 'acme/web'])
  })

  it('matches logins, names and teams', () => {
    expect(suggestHandles('rob')).toEqual(['bo'])
    expect(suggestHandles('web')).toEqual(['acme/web'])
    expect(suggestHandles('zzz')).toEqual([])
  })
})
