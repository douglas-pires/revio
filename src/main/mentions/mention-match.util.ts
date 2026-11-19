import { reviewCommentIdFromUrl } from '@shared/github-url.util.ts'
import type { Mention, MentionSnippet } from '@shared/mention.types.ts'
import { isPresent } from '@shared/presence.util.ts'
import { isSamePull, type PullRef } from '@shared/pull.types.ts'

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

/** Text a person actually wrote: no code, no quoted replies (they repeat someone else's mention). */
function stripQuotesAndCode(body: string) {
  return body
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`[^`\n]*`/gu, ' ')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('>'))
    .join('\n')
}

type Located = RawText & { kind: MentionSnippet['kind']; path: string | null; line: number | null }

function collectTexts(pr: RawMentionPr): Located[] {
  const at =
    (kind: MentionSnippet['kind'], path: string | null = null, line: number | null = null) =>
    (t: RawText): Located => ({ ...t, kind, path, line })
  return [
    at('description')(pr),
    ...pr.comments.nodes.filter(isPresent).map(at('comment')),
    ...pr.reviews.nodes.filter(isPresent).map(at('review')),
    ...pr.reviewThreads.nodes
      .filter(isPresent)
      .flatMap((th) => th.comments.nodes.filter(isPresent).map(at('review-comment', th.path, th.line))),
  ]
}

/** A recent text by someone else that mentions you or a team of yours, as a snippet; otherwise null. */
function toSnippet(t: Located, ctx: MentionContext): MentionSnippet | null {
  if (t.author?.login === ctx.viewer || t.createdAt < ctx.since) {
    return null
  }
  const handle = findMentionedHandle(t.body, [ctx.viewer, ...ctx.teams])
  if (!handle) {
    return null
  }
  return {
    id: t.url,
    kind: t.kind,
    author: t.author?.login ?? 'ghost',
    authorAvatar: t.author?.avatarUrl ?? '',
    body: t.body,
    createdAt: t.createdAt,
    url: t.url,
    path: t.path,
    line: t.line,
    commentId: commentIdOf(t),
    viaTeam: teamOf(handle, ctx.viewer),
    isNew: isUnreadSince(t.createdAt, ctx.notification),
  }
}

/** Written after you last read the PR's notification, while it is unread. */
const isUnreadSince = (createdAt: string, n: NotificationInfo | undefined) =>
  n?.unread === true && (!n.lastReadAt || createdAt > n.lastReadAt)

/** A review comment's id, so the PR can open at it; other texts have none. */
function commentIdOf(t: Located) {
  if (t.kind !== 'review-comment') {
    return null
  }
  return reviewCommentIdFromUrl(t.url)
}

/** The team mentioned, or null when the mention is of you by name. */
function teamOf(handle: string, viewer: string) {
  if (handle.toLowerCase() === viewer.toLowerCase()) {
    return null
  }
  return handle
}

/** GitHub's GraphQL shapes for a PR's texts. */
export interface RawText {
  author: { login: string; avatarUrl: string } | null
  body: string
  createdAt: string
  url: string
}

export interface RawMentionPr extends RawText {
  number: number
  title: string
  state: Mention['state']
  repository: { nameWithOwner: string }
  comments: { nodes: (RawText | null)[] }
  reviews: { nodes: (RawText | null)[] }
  reviewThreads: { nodes: ({ path: string; line: number | null; comments: { nodes: (RawText | null)[] } } | null)[] }
}

/** The PR's GitHub notification: whether it is unread and when you last read it. */
export interface NotificationInfo {
  id: string
  unread: boolean
  lastReadAt: string | null
}

export interface MentionContext {
  viewer: string
  /** Your teams as org/slug, for @org/slug mentions. */
  teams: readonly string[]
  /** Only mentions at or after this time (ISO). */
  since: string
  notification?: NotificationInfo | undefined
}

/** The first of `handles` mentioned as @handle in the body, or null. Case-insensitive, whole handles only. */
export function findMentionedHandle(body: string, handles: readonly string[]): string | null {
  const text = stripQuotesAndCode(body)
  return handles.find((h) => new RegExp(`(?:^|[^\\w/@-])@${escapeRegExp(h)}(?![\\w/-])`, 'iu').test(text)) ?? null
}

/** The PR's recent mentions of you (by name or team), newest first; null when there are none. */
export function buildMention(pr: RawMentionPr, ctx: MentionContext): Mention | null {
  const snippets = collectTexts(pr)
    .flatMap((t) => toSnippet(t, ctx) ?? [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const [latest] = snippets
  if (latest === undefined) {
    return null
  }
  return {
    repo: pr.repository.nameWithOwner,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    notificationId: ctx.notification?.id ?? null,
    snippets,
    latestAt: latest.createdAt,
  }
}

/** PRs with unread mentions first, then the most recent. */
export function sortMentions(mentions: Mention[]): Mention[] {
  const hasNew = (m: Mention) => m.snippets.some((s) => s.isNew)
  return [...mentions].sort((a, b) => Number(hasNew(b)) - Number(hasNew(a)) || b.latestAt.localeCompare(a.latestAt))
}

/** Marks every snippet of a PR as read, as after marking its notification read. */
export function markMentionRead(mentions: readonly Mention[], ref: PullRef): Mention[] {
  return mentions.map((m) => {
    if (!isSamePull(m, ref)) {
      return m
    }
    return { ...m, snippets: m.snippets.map((s) => ({ ...s, isNew: false })) }
  })
}
