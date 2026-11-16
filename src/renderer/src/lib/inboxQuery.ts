import type { OpenThread, PullSummary, StackPr } from '@shared/types'

/**
 * GitHub-style search for the inbox: free text plus qualifiers such as
 * `user-review-requested:@me`, `team-review-requested:web`, `repo:acme/web`, `author:ana`, `is:draft`, `-is:stale`.
 */
export interface InboxQuery {
  terms: string[]
  filters: Filter[]
}

interface Filter {
  key: FilterKey
  value: string
  negated: boolean
}

/** The fields a query looks at, shared by inbox rows and stack members. */
export interface Searchable {
  repo: string
  title: string
  author: string
  number: number
  headRef: string
  baseRef: string
  isDraft: boolean
  stale: boolean
  reviewDecision: string | null
  stacked: boolean
  /** Your review is currently requested (directly or through a team). */
  requested: boolean
  /** The team the request came through, or null when it is addressed to you. */
  viaTeam: string | null
  /** The latest comment came from a bot (threads only). */
  bot?: boolean
  /** More text free-text terms may match, e.g. a thread's file path and comments. */
  text?: string
}

const lower = (s: string) => s.toLowerCase()
const withoutAt = (s: string) => s.replace(/^@/, '')
/** "acme/web" and "web" both name the team slug "web"; GitHub writes team qualifiers as org/slug. */
const teamSlug = (s: string) => lower(withoutAt(s)).split('/').at(-1) ?? ''

const IS: Record<string, (pr: Searchable) => boolean> = {
  draft: (pr) => pr.isDraft,
  stale: (pr) => pr.stale,
  stacked: (pr) => pr.stacked,
  approved: (pr) => pr.reviewDecision === 'APPROVED',
  'changes-requested': (pr) => pr.reviewDecision === 'CHANGES_REQUESTED',
  bot: (pr) => !!pr.bot,
}

/** One predicate per qualifier (Strategy as plain functions). */
const QUALIFIERS = {
  repo: (pr: Searchable, v: string) => lower(pr.repo) === lower(v) || lower(pr.repo.split('/')[1] ?? '') === lower(v),
  author: (pr: Searchable, v: string) => lower(pr.author) === lower(withoutAt(v)),
  head: (pr: Searchable, v: string) => pr.headRef === v,
  base: (pr: Searchable, v: string) => pr.baseRef === v,
  is: (pr: Searchable, v: string) => IS[lower(v)]?.(pr) ?? false,
  'review-requested': (pr: Searchable) => pr.requested,
  'user-review-requested': (pr: Searchable) => pr.requested && !pr.viaTeam,
  'team-review-requested': (pr: Searchable, v: string) => pr.requested && !!pr.viaTeam && (v === '*' || lower(pr.viaTeam) === teamSlug(v)),
} satisfies Record<string, (pr: Searchable, value: string) => boolean>

type FilterKey = keyof typeof QUALIFIERS

const REVIEW_KEYS: readonly FilterKey[] = ['review-requested', 'user-review-requested', 'team-review-requested']

const isFilterKey = (key: string): key is FilterKey => key in QUALIFIERS

const TOKEN = /(-?)([a-z][a-z-]*):("[^"]*"|\S+)|"([^"]*)"|(\S+)/gi

export function parseQuery(text: string): InboxQuery {
  const query: InboxQuery = { terms: [], filters: [] }
  for (const m of text.matchAll(TOKEN)) {
    const [whole, minus, key, rawValue, quoted, word] = m
    if (key && rawValue && isFilterKey(lower(key))) {
      query.filters.push({ key: lower(key) as FilterKey, value: rawValue.replace(/^"|"$/g, ''), negated: minus === '-' })
    } else {
      query.terms.push(lower(quoted ?? word ?? whole))
    }
  }
  return query
}

export const isEmptyQuery = (q: InboxQuery) => !q.terms.length && !q.filters.length

export function matchesQuery(pr: Searchable, query: InboxQuery): boolean {
  const haystack = lower(`${pr.repo} ${pr.title} ${pr.author} #${pr.number} ${pr.headRef} ${pr.text ?? ''}`)
  if (!query.terms.every((t) => haystack.includes(t))) return false
  return query.filters.every((f) => QUALIFIERS[f.key](pr, f.value) !== f.negated)
}

export function summaryToSearchable(pr: PullSummary, requested: boolean): Searchable {
  return { ...pr, stacked: !!pr.stack, requested, viaTeam: pr.viaTeam }
}

/** Stack members outside your inbox have no request; members inside it reuse the inbox row's team. */
export function stackPrToSearchable(pr: StackPr, inboxRow: PullSummary | undefined): Searchable {
  return { ...pr, stacked: true, requested: pr.inbox === 'requested', viaTeam: inboxRow?.viaTeam ?? null }
}

/** A thread searches by its PR's fields plus its file path and comments. Review-request qualifiers never match. */
export function threadToSearchable(t: OpenThread): Searchable {
  return {
    repo: t.repo,
    title: t.prTitle,
    author: t.prAuthor,
    number: t.number,
    headRef: '',
    baseRef: '',
    isDraft: t.isDraft,
    stale: false,
    reviewDecision: null,
    stacked: false,
    requested: false,
    viaTeam: null,
    bot: !!t.comments.at(-1)?.bot,
    text: [t.path, ...t.comments.map((c) => `${c.author} ${c.body}`)].join(' '),
  }
}

/** Who a review request is addressed to, as picked from the All / Me / team buttons. */
export type ReviewAudience = { kind: 'all' } | { kind: 'me' } | { kind: 'team'; team: string }

/** Replaces the review-request qualifiers in the query text, keeping everything else the user typed. */
export function withAudience(text: string, audience: ReviewAudience): string {
  const kept = [...text.matchAll(TOKEN)].map((m) => m[0]).filter((token) => !isReviewToken(token))
  const qualifier = audienceQualifier(audience)
  return [...(qualifier ? [qualifier] : []), ...kept].join(' ') + (kept.length || qualifier ? ' ' : '')
}

function audienceQualifier(audience: ReviewAudience): string | null {
  if (audience.kind === 'me') return 'user-review-requested:@me'
  if (audience.kind === 'team') return `team-review-requested:${audience.team}`
  return null
}

const isReviewToken = (token: string) => REVIEW_KEYS.some((key) => lower(token).replace(/^-/, '').startsWith(`${key}:`))

/** The audience the query currently selects, so the buttons can show which one is active. */
export function audienceOf(query: InboxQuery): ReviewAudience | null {
  const review = query.filters.filter((f) => REVIEW_KEYS.includes(f.key))
  if (!review.length) return { kind: 'all' }
  const [only] = review
  if (review.length > 1 || only!.negated) return null
  if (only!.key === 'user-review-requested') return { kind: 'me' }
  if (only!.key === 'team-review-requested' && only!.value !== '*') return { kind: 'team', team: teamSlug(only!.value) }
  return null
}

/** Teams your open requests came through, with how many each, largest first. */
export function countTeams(requested: readonly PullSummary[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const pr of requested) if (pr.viaTeam) counts.set(pr.viaTeam, (counts.get(pr.viaTeam) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
