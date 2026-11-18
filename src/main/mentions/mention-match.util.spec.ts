import { describe, expect, it } from 'vitest'
import { buildMention, findMentionedHandle, markMentionRead, sortMentions, type RawMentionPr, type RawText } from './mention-match.util'

describe('findMentionedHandle', () => {
  const handles = ['octo-cat', 'acme/platform-team']

  it.each([
    ['cc @octo-cat', 'octo-cat'],
    ['@Octo-Cat can you look?', 'octo-cat'],
    ['ping @acme/platform-team', 'acme/platform-team'],
    ['(@octo-cat)', 'octo-cat'],
  ])('finds %j', (body, handle) => expect(findMentionedHandle(body, handles)).toBe(handle))

  it.each([
    ['@octo-cat-bot says hi'],
    ['email someone@example.com'],
    ['@acme/platform-team-leads'],
    ['`@octo-cat` in code'],
    ['```\n@octo-cat\n```'],
    ['> @octo-cat asked this earlier\nthanks!'],
  ])('ignores %j', (body) => expect(findMentionedHandle(body, handles)).toBeNull())
})

const text = (login: string, body: string, createdAt: string, url = `u-${createdAt}`): RawText => ({ author: { login, avatarUrl: '' }, body, createdAt, url })

function makePr(over: Partial<RawMentionPr> = {}): RawMentionPr {
  return {
    ...text('ana', 'Adds a cache', '2026-11-01T00:00:00Z', 'pr-url'),
    number: 7, title: 'Add cache', state: 'OPEN', repository: { nameWithOwner: 'acme/web' },
    comments: { nodes: [] }, reviews: { nodes: [] }, reviewThreads: { nodes: [] }, ...over,
  }
}

const ctx = { viewer: 'me', teams: ['acme/web-team'], since: '2026-11-02T00:00:00Z' }

describe('buildMention', () => {
  it('collects mentions from comments, reviews and review threads, newest first, skipping your own and old ones', () => {
    const pr = makePr({
      body: 'cc @me (too old: before the window)',
      comments: { nodes: [text('bo', '@me thoughts?', '2026-11-03T00:00:00Z'), text('me', 'note to @me', '2026-11-04T00:00:00Z'), null] },
      reviews: { nodes: [text('cy', 'LGTM @acme/web-team', '2026-11-05T00:00:00Z')] },
      reviewThreads: { nodes: [{ path: 'src/a.ts', line: 12, comments: { nodes: [text('bo', '@me is this right?', '2026-11-06T00:00:00Z', 'https://github.com/o/r/pull/1#discussion_r42')] } }] },
    })
    const m = buildMention(pr, ctx)!
    expect(m.snippets.map((s) => [s.kind, s.author, s.viaTeam, s.path, s.line, s.commentId])).toEqual([
      ['review-comment', 'bo', null, 'src/a.ts', 12, 42],
      ['review', 'cy', 'acme/web-team', null, null, null],
      ['comment', 'bo', null, null, null, null],
    ])
    expect(m.latestAt).toBe('2026-11-06T00:00:00Z')
  })

  it('is new only when the notification is unread and the mention is after your last read', () => {
    const pr = makePr({ comments: { nodes: [text('bo', '@me a', '2026-11-03T00:00:00Z'), text('bo', '@me b', '2026-11-08T00:00:00Z')] } })
    const m = buildMention(pr, { ...ctx, notification: { id: 'N1', unread: true, lastReadAt: '2026-11-05T00:00:00Z' } })!
    expect(m.notificationId).toBe('N1')
    expect(m.snippets.map((s) => s.isNew)).toEqual([true, false])
    expect(buildMention(pr, ctx)!.snippets.every((s) => !s.isNew)).toBe(true)
  })

  it('returns null without mentions', () => {
    expect(buildMention(makePr({ comments: { nodes: [text('bo', 'no ping', '2026-11-03T00:00:00Z')] } }), ctx)).toBeNull()
  })
})

describe('sortMentions and markMentionRead', () => {
  const unread = buildMention(makePr({ number: 1, comments: { nodes: [text('bo', '@me', '2026-11-03T00:00:00Z')] } }), { ...ctx, notification: { id: 'N', unread: true, lastReadAt: null } })!
  const recent = buildMention(makePr({ number: 2, comments: { nodes: [text('bo', '@me', '2026-11-09T00:00:00Z')] } }), ctx)!

  it('puts PRs with new mentions first', () => {
    expect(sortMentions([recent, unread]).map((m) => m.number)).toEqual([1, 2])
  })

  it('clears new on one PR only', () => {
    const [a, b] = markMentionRead([unread, recent], { repo: 'acme/web', number: 1 })
    expect(a!.snippets.some((s) => s.isNew)).toBe(false)
    expect(b).toBe(recent)
  })
})
