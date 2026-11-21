import { reviewCommentIdFromUrl } from '@shared/github-url.util.ts'
import type { Mention, MentionSnippet } from '@shared/mention.types.ts'
import { isPresent } from '@shared/presence.util.ts'
import { isSamePull, type PullRef } from '@shared/pull.types.ts'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

/** Text a person actually wrote: no code, no quoted replies (they repeat someone else's mention). */
function stripQuotesAndCode(body: string) {
  return body
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`[^`\n]*`/gu, ' ')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n')
}

type Located = RawText & { kind: MentionSnippet['kind']; path: string | null; line: number | null }

function collectTexts(pr: RawMentionPr): Located[] {
  const readAt =
    (kind: MentionSnippet['kind'], path: string | null = null, line: number | null = null) =>
    (text: RawText): Located => ({ ...text, kind, path, line })
  return [
    readAt('description')(pr),
    ...pr.comments.nodes.filter(isPresent).map(readAt('comment')),
    ...pr.reviews.nodes.filter(isPresent).map(readAt('review')),
    ...pr.reviewThreads.nodes
      .filter(isPresent)
      .flatMap((thread) =>
        thread.comments.nodes.filter(isPresent).map(readAt('review-comment', thread.path, thread.line)),
      ),
  ]
}

/** A recent text by someone else that mentions you or a team of yours, as a snippet; otherwise null. */
function toSnippet(located: Located, context: MentionContext): MentionSnippet | null {
  if (located.author?.login === context.viewer || located.createdAt < context.since) {
    return null
  }
  const handle = findMentionedHandle(located.body, [context.viewer, ...context.teams])
  if (!handle) {
    return null
  }
  return {
    id: located.url,
    kind: located.kind,
    author: located.author?.login ?? 'ghost',
    authorAvatar: located.author?.avatarUrl ?? '',
    body: located.body,
    createdAt: located.createdAt,
    url: located.url,
    path: located.path,
    line: located.line,
    commentId: commentIdOf(located),
    viaTeam: findTeam(handle, context.viewer),
    isNew: isUnreadSince(located.createdAt, context.notification),
  }
}

/** Written after you last read the PR's notification, while it is unread. */
const isUnreadSince = (createdAt: string, notification: NotificationInfo | undefined) =>
  notification?.unread === true && (!notification.lastReadAt || createdAt > notification.lastReadAt)

/** A review comment's id, so the PR can open at it; other texts have none. */
function commentIdOf(located: Located) {
  if (located.kind !== 'review-comment') {
    return null
  }
  return reviewCommentIdFromUrl(located.url)
}

/** The team mentioned, or null when the mention is of you by name. */
function findTeam(handle: string, viewer: string) {
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
  return (
    handles.find((handle) => new RegExp(`(?:^|[^\\w/@-])@${escapeRegExp(handle)}(?![\\w/-])`, 'iu').test(text)) ?? null
  )
}

/** The PR's recent mentions of you (by name or team), newest first; null when there are none. */
export function buildMention(pr: RawMentionPr, context: MentionContext): Mention | null {
  const snippets = collectTexts(pr)
    .flatMap((text) => toSnippet(text, context) ?? [])
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
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
    notificationId: context.notification?.id ?? null,
    snippets,
    latestAt: latest.createdAt,
  }
}

/** PRs with unread mentions first, then the most recent. */
export function sortMentions(mentions: Mention[]): Mention[] {
  const hasNew = (mention: Mention) => mention.snippets.some((snippet) => snippet.isNew)
  return [...mentions].sort(
    (left, right) => Number(hasNew(right)) - Number(hasNew(left)) || right.latestAt.localeCompare(left.latestAt),
  )
}

/** Marks every snippet of a PR as read, as after marking its notification read. */
export function markMentionRead(mentions: readonly Mention[], ref: PullRef): Mention[] {
  return mentions.map((mention) => {
    if (!isSamePull(mention, ref)) {
      return mention
    }
    return { ...mention, snippets: mention.snippets.map((snippet) => ({ ...snippet, isNew: false })) }
  })
}
