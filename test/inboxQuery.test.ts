import { describe, expect, it } from 'vitest'
import {
  readAudience,
  countTeams,
  matchesQuery,
  parseQuery,
  stackPrToSearchable,
  summaryToSearchable,
  threadToSearchable,
  applyAudience,
  type Searchable,
} from '@/lib/inboxQuery'
import type { OpenThread, StackPr } from '@shared/types'
import { makeSummary } from './fixtures'

const direct = summaryToSearchable(makeSummary({ id: 'D', title: 'Fix login redirect', author: 'ana' }), true)
const viaWeb = summaryToSearchable(makeSummary({ id: 'W', title: 'Bump deps', author: 'bo', viaTeam: 'web', isDraft: true }), true)
const viaApi = summaryToSearchable(makeSummary({ id: 'A', repo: 'acme/api', title: 'Add rate limit', viaTeam: 'api', stale: true }), true)
const reviewed = summaryToSearchable(makeSummary({ id: 'R', title: 'Old work', reviewDecision: 'APPROVED' }), false)
const all = [direct, viaWeb, viaApi, reviewed]

const search = (text: string, items: Searchable[] = all) => items.filter((pr) => matchesQuery(pr, parseQuery(text))).map((pr) => pr.title)

describe('review audience qualifiers', () => {
  it('user-review-requested:@me keeps only requests addressed to you', () => {
    expect(search('user-review-requested:@me')).toEqual(['Fix login redirect'])
  })

  it('team-review-requested matches the slug with or without the org', () => {
    expect(search('team-review-requested:web')).toEqual(['Bump deps'])
    expect(search('team-review-requested:acme/api')).toEqual(['Add rate limit'])
    expect(search('team-review-requested:*')).toEqual(['Bump deps', 'Add rate limit'])
  })

  it('review-requested:@me keeps every open request and drops PRs you already reviewed', () => {
    expect(search('review-requested:@me')).toEqual(['Fix login redirect', 'Bump deps', 'Add rate limit'])
  })

  it('negation excludes a team', () => {
    expect(search('review-requested:@me -team-review-requested:web')).toEqual(['Fix login redirect', 'Add rate limit'])
  })
})

describe('other qualifiers and text', () => {
  it.each([
    ['repo:acme/api', ['Add rate limit']],
    ['repo:API', ['Add rate limit']],
    ['author:@bo', ['Bump deps']],
    ['is:draft', ['Bump deps']],
    ['-is:stale is:approved', ['Old work']],
    ['login fix', ['Fix login redirect']],
    ['"rate limit"', ['Add rate limit']],
    ['is:unknown', []],
  ])('%s', (text, titles) => expect(search(text)).toEqual(titles))

  it('treats unknown qualifiers as text, so URLs and times still search', () => {
    expect(parseQuery('foo:bar').terms).toEqual(['foo:bar'])
  })

  it('combines text with qualifiers', () => {
    expect(search('deps team-review-requested:web')).toEqual(['Bump deps'])
    expect(search('deps user-review-requested:@me')).toEqual([])
  })
})

describe('stack members', () => {
  const member = (inbox: StackPr['inbox']): StackPr => ({
    id: 'W', number: 2, title: 'Bump deps', url: '', repo: 'acme/web', author: 'bo', authorAvatar: '',
    headRef: 'b', baseRef: 'a', isDraft: false, reviewDecision: null, inbox, stale: false,
  })

  it('reuses the inbox row team, and has no request when outside the inbox', () => {
    const row = makeSummary({ id: 'W', viaTeam: 'web' })
    expect(matchesQuery(stackPrToSearchable(member('requested'), row), parseQuery('team-review-requested:web'))).toBe(true)
    expect(matchesQuery(stackPrToSearchable(member(null), undefined), parseQuery('review-requested:@me'))).toBe(false)
    expect(matchesQuery(stackPrToSearchable(member(null), undefined), parseQuery('is:stacked'))).toBe(true)
  })
})

describe('threads', () => {
  const thread = (bot: boolean): OpenThread => ({
    id: 't', repo: 'acme/web', number: 3, prTitle: 'Speed up', prUrl: '', prAuthor: 'me', isDraft: false, path: 'src/cache.ts', line: 4,
    outdated: false, totalComments: 1, waitingOn: 'you', lastActivityAt: '',
    comments: [{ author: bot ? 'semgrep' : 'bo', authorAvatar: '', bot, body: 'Consider a TTL here', createdAt: '', url: '' }],
  })

  it('match their file path and comment text', () => {
    expect(matchesQuery(threadToSearchable(thread(false)), parseQuery('cache.ts ttl'))).toBe(true)
  })

  it('-is:bot hides threads a bot spoke last in', () => {
    expect(matchesQuery(threadToSearchable(thread(true)), parseQuery('-is:bot'))).toBe(false)
    expect(matchesQuery(threadToSearchable(thread(false)), parseQuery('-is:bot'))).toBe(true)
  })

  it('never match review-request qualifiers', () => {
    expect(matchesQuery(threadToSearchable(thread(false)), parseQuery('review-requested:@me'))).toBe(false)
  })
})

describe('applyAudience', () => {
  it('swaps the review qualifier and keeps the rest of the query', () => {
    expect(applyAudience('repo:acme/web login ', { kind: 'me' })).toBe('user-review-requested:@me repo:acme/web login ')
    expect(applyAudience('user-review-requested:@me login', { kind: 'team', team: 'web' })).toBe('team-review-requested:web login ')
    expect(applyAudience('-team-review-requested:web login', { kind: 'all' })).toBe('login ')
    expect(applyAudience('team-review-requested:web', { kind: 'all' })).toBe('')
  })
})

describe('readAudience', () => {
  it.each([
    ['', { kind: 'all' }],
    ['login', { kind: 'all' }],
    ['user-review-requested:@me', { kind: 'me' }],
    ['team-review-requested:acme/Web', { kind: 'team', team: 'web' }],
    ['review-requested:@me', null],
    ['-user-review-requested:@me', null],
  ])('%j', (text, audience) => expect(readAudience(parseQuery(text))).toEqual(audience))
})

describe('countTeams', () => {
  it('counts requests per team, largest first', () => {
    const prs = [makeSummary({ viaTeam: 'web' }), makeSummary({ viaTeam: 'api' }), makeSummary({ viaTeam: 'web' }), makeSummary()]
    expect(countTeams(prs)).toEqual([
      ['web', 2],
      ['api', 1],
    ])
  })
})
