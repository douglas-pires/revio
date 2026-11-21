import { describe, expect, it } from 'vitest'
import { makeGuideline } from '../../../test/fixtures.ts'
import { matchGuidelines, normalizePath } from './guidelines.service.ts'

describe('matchGuidelines', () => {
  const all = [
    makeGuideline('web-app', 'acme/web', 'apps/web/'),
    makeGuideline('web', 'Acme/Web'),
    makeGuideline('global', '*'),
    makeGuideline('api-app', 'acme/web', 'apps/api/'),
    makeGuideline('web-deep', 'acme/web', 'apps/web/src/'),
    makeGuideline('off', '*', '', false),
  ]

  it('orders general to specific and skips folders the PR does not touch', () => {
    const out = matchGuidelines(all, 'acme/web', ['apps/web/src/a.ts', 'apps/web/b.ts', 'README.md'])
    expect(out.map((match) => [match.id, match.matchedFiles])).toEqual([
      ['global', 3],
      ['web', 3],
      ['web-app', 2],
      ['web-deep', 1],
    ])
  })

  it('does not match a folder that is only a name prefix', () => {
    expect(matchGuidelines([makeGuideline('app', 'acme/web', 'app/')], 'acme/web', ['apps/x.ts'])).toEqual([])
  })

  it('ignores other repositories', () => {
    expect(matchGuidelines(all, 'acme/api', ['apps/web/a.ts']).map((match) => match.id)).toEqual(['global'])
  })
})

describe('normalizePath', () => {
  it.each([
    ['/apps/web', 'apps/web/'],
    ['apps/web//', 'apps/web/'],
    ['  ', ''],
  ])('%j → %j', (input, out) => expect(normalizePath(input)).toBe(out))
})
