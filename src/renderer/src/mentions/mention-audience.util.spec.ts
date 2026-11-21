import type { Mention, MentionSnippet } from '@shared/mention.types.ts'
import { describe, expect, it } from 'vitest'
import { countAudiences, describeAudience, matchesAudience, sameAudience } from '@/mentions/mention-audience.util.ts'

function makeSnippet(viaTeam: string | null): MentionSnippet {
  return {
    id: `s-${viaTeam}`,
    kind: 'comment',
    author: 'priya',
    authorAvatar: '',
    body: 'hi',
    createdAt: '2026-11-01T00:00:00Z',
    url: 'https://github.com/acme/web/pull/1',
    isNew: false,
    viaTeam,
    path: null,
    line: null,
    commentId: null,
  }
}

function makeMention(number: number, ...teams: (string | null)[]): Mention {
  return { repo: 'acme/web', number, snippets: teams.map(makeSnippet) } as Mention
}

const mentions = [
  makeMention(1, null),
  makeMention(2, 'acme/frontend'),
  makeMention(3, null, 'acme/frontend'),
  makeMention(4, 'acme/api'),
]

describe('matchesAudience', () => {
  it('keeps everything for All', () => {
    expect(
      mentions.filter((candidate) => matchesAudience(candidate, { kind: 'all' })).map((candidate) => candidate.number),
    ).toEqual([1, 2, 3, 4])
  })

  it('keeps PRs that name you directly for Me', () => {
    expect(
      mentions.filter((candidate) => matchesAudience(candidate, { kind: 'me' })).map((candidate) => candidate.number),
    ).toEqual([1, 3])
  })

  it('keeps PRs that name the team', () => {
    const team = { kind: 'team', team: 'acme/frontend' } as const
    expect(
      mentions.filter((candidate) => matchesAudience(candidate, team)).map((candidate) => candidate.number),
    ).toEqual([2, 3])
  })
})

describe('audienceCounts', () => {
  it('counts All, Me, then teams by how often they were mentioned', () => {
    expect(countAudiences(mentions).map((count) => [describeAudience(count.audience), count.count])).toEqual([
      ['All', 4],
      ['Me', 2],
      ['@acme/frontend', 2],
      ['@acme/api', 1],
    ])
  })
})

describe('sameAudience', () => {
  it('tells teams apart', () => {
    expect(sameAudience({ kind: 'team', team: 'a' }, { kind: 'team', team: 'b' })).toBe(false)
    expect(sameAudience({ kind: 'me' }, { kind: 'me' })).toBe(true)
  })
})
