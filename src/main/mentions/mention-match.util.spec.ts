import type { MentionSnippet } from '@shared/mention.types.ts'
import { describe, expect, it } from 'vitest'
import { assertPresent } from '../../../test/fixtures.ts'
import {
  buildMention,
  findMentionedHandle,
  markMentionRead,
  type RawMentionPr,
  type RawText,
  sortMentions,
} from './mention-match.util.ts'

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

const makeText = (login: string, body: string, createdAt: string, url = `u-${createdAt}`): RawText => ({
  author: { login, avatarUrl: '' },
  body,
  createdAt,
  url,
})

function makePr(over: Partial<RawMentionPr> = {}): RawMentionPr {
  return {
    ...makeText('ana', 'Adds a cache', '2026-11-01T00:00:00Z', 'pr-url'),
    number: 7,
    title: 'Add cache',
    state: 'OPEN',
    repository: { nameWithOwner: 'acme/web' },
    comments: { nodes: [] },
    reviews: { nodes: [] },
    reviewThreads: { nodes: [] },
    ...over,
  }
}

const ctx = { viewer: 'me', teams: ['acme/web-team'], since: '2026-11-02T00:00:00Z' }

/** A PR with mentions everywhere they can be: an old one in the description, comments, a review and a thread. */
const MIXED_MENTIONS_PR = makePr({
  body: 'cc @me (too old: before the window)',
  comments: {
    nodes: [
      makeText('bo', '@me thoughts?', '2026-11-03T00:00:00Z'),
      makeText('me', 'note to @me', '2026-11-04T00:00:00Z'),
      null,
    ],
  },
  reviews: { nodes: [makeText('cy', 'LGTM @acme/web-team', '2026-11-05T00:00:00Z')] },
  reviewThreads: {
    nodes: [
      {
        path: 'src/a.ts',
        line: 12,
        comments: {
          nodes: [
            makeText(
              'bo',
              '@me is this right?',
              '2026-11-06T00:00:00Z',
              'https://github.com/o/r/pull/1#discussion_r42',
            ),
          ],
        },
      },
    ],
  },
})

/** The parts of a snippet the first test checks: where it came from and who wrote it. */
const describeSnippet = (snippet: MentionSnippet) => [
  snippet.kind,
  snippet.author,
  snippet.viaTeam,
  snippet.path,
  snippet.line,
  snippet.commentId,
]

describe('buildMention', () => {
  it('collects mentions from comments, reviews and review threads, newest first, skipping your own and old ones', () => {
    const mention = assertPresent(buildMention(MIXED_MENTIONS_PR, ctx))
    expect(mention.snippets.map(describeSnippet)).toEqual([
      ['review-comment', 'bo', null, 'src/a.ts', 12, 42],
      ['review', 'cy', 'acme/web-team', null, null, null],
      ['comment', 'bo', null, null, null, null],
    ])
    expect(mention.latestAt).toBe('2026-11-06T00:00:00Z')
  })

  it('is new only when the notification is unread and the mention is after your last read', () => {
    const pr = makePr({
      comments: {
        nodes: [makeText('bo', '@me a', '2026-11-03T00:00:00Z'), makeText('bo', '@me b', '2026-11-08T00:00:00Z')],
      },
    })
    const mention = assertPresent(
      buildMention(pr, { ...ctx, notification: { id: 'N1', unread: true, lastReadAt: '2026-11-05T00:00:00Z' } }),
    )
    expect(mention.notificationId).toBe('N1')
    expect(mention.snippets.map((snippet) => snippet.isNew)).toEqual([true, false])
    expect(buildMention(pr, ctx)?.snippets.every((snippet) => !snippet.isNew)).toBe(true)
  })

  it('returns null without mentions', () => {
    expect(
      buildMention(makePr({ comments: { nodes: [makeText('bo', 'no ping', '2026-11-03T00:00:00Z')] } }), ctx),
    ).toBeNull()
  })
})

describe('sortMentions and markMentionRead', () => {
  const unread = assertPresent(
    buildMention(makePr({ number: 1, comments: { nodes: [makeText('bo', '@me', '2026-11-03T00:00:00Z')] } }), {
      ...ctx,
      notification: { id: 'N', unread: true, lastReadAt: null },
    }),
  )
  const recent = assertPresent(
    buildMention(makePr({ number: 2, comments: { nodes: [makeText('bo', '@me', '2026-11-09T00:00:00Z')] } }), ctx),
  )

  it('puts PRs with new mentions first', () => {
    expect(sortMentions([recent, unread]).map((mention) => mention.number)).toEqual([1, 2])
  })

  it('clears new on one PR only', () => {
    const [first, second] = markMentionRead([unread, recent], { repo: 'acme/web', number: 1 })
    expect(first?.snippets.some((snippet) => snippet.isNew)).toBe(false)
    expect(second).toBe(recent)
  })
})
