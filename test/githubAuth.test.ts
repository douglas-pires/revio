import { describe, expect, it } from 'vitest'
import { parseScopes } from '../src/main/githubAuth'

describe('parseScopes', () => {
  it('splits a classic token scope header', () => {
    expect(parseScopes('repo, read:org,  gist')).toEqual(['repo', 'read:org', 'gist'])
  })

  it('returns an empty list for a classic token with no scopes', () => {
    expect(parseScopes('')).toEqual([])
  })

  it('returns null for fine-grained tokens, which send no scope header', () => {
    expect(parseScopes(undefined)).toBeNull()
  })
})
