import type { Mention, MentionSnippet } from '@shared/types'

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
  notification?: NotificationInfo
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Text a person actually wrote: no code, no quoted replies (they repeat someone else's mention). */
function authoredText(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('>'))
    .join('\n')
}

/** The first of `handles` mentioned as @handle in the body, or null. Case-insensitive, whole handles only. */
export function findMentionedHandle(body: string, handles: readonly string[]): string | null {
  const text = authoredText(body)
  return handles.find((h) => new RegExp(`(^|[^\\w/@-])@${escapeRegExp(h)}(?![\\w/-])`, 'i').test(text)) ?? null
}

type Located = RawText & { kind: MentionSnippet['kind']; path: string | null; line: number | null }

function textsOf(pr: RawMentionPr): Located[] {
  const at = (kind: MentionSnippet['kind'], path: string | null = null, line: number | null = null) => (t: RawText | null): Located[] =>
    t ? [{ ...t, kind, path, line }] : []
  return [
    ...at('description')(pr),
    ...pr.comments.nodes.flatMap(at('comment')),
    ...pr.reviews.nodes.flatMap(at('review')),
    ...pr.reviewThreads.nodes.flatMap((th) => (th ? th.comments.nodes.flatMap(at('review-comment', th.path, th.line)) : [])),
  ]
}

/** The PR's recent mentions of you (by name or team), newest first; null when there are none. */
export function buildMention(pr: RawMentionPr, ctx: MentionContext): Mention | null {
  const handles = [ctx.viewer, ...ctx.teams]
  const n = ctx.notification
  const snippets = textsOf(pr).flatMap((t): MentionSnippet[] => {
    if (t.author?.login === ctx.viewer || t.createdAt < ctx.since) return []
    const handle = findMentionedHandle(t.body, handles)
    if (!handle) return []
    return [
      {
        id: t.url,
        kind: t.kind,
        author: t.author?.login ?? 'ghost',
        authorAvatar: t.author?.avatarUrl ?? '',
        body: t.body,
        createdAt: t.createdAt,
        url: t.url,
        path: t.path,
        line: t.line,
        viaTeam: handle.toLowerCase() === ctx.viewer.toLowerCase() ? null : handle,
        isNew: !!n?.unread && (!n.lastReadAt || t.createdAt > n.lastReadAt),
      },
    ]
  })
  if (!snippets.length) return null
  snippets.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return {
    repo: pr.repository.nameWithOwner,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    notificationId: n?.id ?? null,
    snippets,
    latestAt: snippets[0]!.createdAt,
  }
}

/** PRs with unread mentions first, then the most recent. */
export function sortMentions(mentions: Mention[]): Mention[] {
  const hasNew = (m: Mention) => m.snippets.some((s) => s.isNew)
  return [...mentions].sort((a, b) => Number(hasNew(b)) - Number(hasNew(a)) || b.latestAt.localeCompare(a.latestAt))
}

/** Marks every snippet of a PR as read, as after marking its notification read. */
export function markMentionRead(mentions: readonly Mention[], repo: string, number: number): Mention[] {
  return mentions.map((m) => (m.repo === repo && m.number === number ? { ...m, snippets: m.snippets.map((s) => ({ ...s, isNew: false })) } : m))
}
