import { describe, expect, it } from 'vitest'
import { matchFuzzy, rankFuzzyMatches } from './fuzzy-match.util.ts'

describe('matchFuzzy', () => {
  it('matches the query letters in order, ignoring case and spaces', () => {
    expect(matchFuzzy('fix login', 'Fix login redirect')?.positions).toEqual([0, 1, 2, 4, 5, 6, 7, 8])
    expect(matchFuzzy('gls', 'src/main/gitlog/git-log.service.ts')).not.toBeNull()
    expect(matchFuzzy('xyz', 'Fix login')).toBeNull()
  })

  it('picks the best way to match: word starts and runs over the first letters found', () => {
    // "lg" could take the "l" of "help"; the word start of "log" scores higher.
    expect(matchFuzzy('log', 'help: log out')?.positions).toEqual([6, 7, 8])
  })

  it('drops matches so scattered that they say nothing', () => {
    expect(matchFuzzy('abcd', 'xaxxxxxbxxxxxcxxxxxd')).toBeNull()
  })

  it('matches everything for an empty query', () => {
    expect(matchFuzzy('  ', 'anything')).toEqual({ score: 0, positions: [] })
  })
})

describe('rankFuzzyMatches', () => {
  const paths = [
    'src/renderer/src/gitlog/commit-list.component.tsx',
    'src/main/gitlog/git-log.service.ts',
    'src/main/gitlog/git-log.util.ts',
    'README.md',
  ]

  it('ranks file-name matches first and keeps only matches, up to the limit', () => {
    const ranked = rankFuzzyMatches('gitlogservice', paths, (path) => path, 2)
    expect(ranked.map((match) => match.item)).toEqual(['src/main/gitlog/git-log.service.ts'])
  })

  it('prefers a run in the file name over letters spread along the path', () => {
    const ranked = rankFuzzyMatches('util', paths, (path) => path, 3)
    expect(ranked[0]?.item).toBe('src/main/gitlog/git-log.util.ts')
  })
})
