import type { PullSummary, StackPr } from '@shared/inbox.types.ts'
import { isPresent } from '@shared/presence.util.ts'
import type { OpenThread } from '@shared/thread.types.ts'

interface Filter {
  key: FilterKey
  value: string
  negated: boolean
}

const toLower = (text: string) => text.toLowerCase()

const LEADING_AT = /^@/u
const LEADING_MINUS = /^-/u
const QUOTES = /^"|"$/gu

const stripAt = (text: string) => text.replace(LEADING_AT, '')

/** "acme/web" and "web" both name the team slug "web"; GitHub writes team qualifiers as org/slug. */
const toTeamSlug = (text: string) => toLower(stripAt(text)).split('/').at(-1) ?? ''

const IS: Record<string, (pr: Searchable) => boolean> = {
  draft: (pr) => pr.isDraft,
  stale: (pr) => pr.stale,
  stacked: (pr) => pr.stacked,
  approved: (pr) => pr.reviewDecision === 'APPROVED',
  'changes-requested': (pr) => pr.reviewDecision === 'CHANGES_REQUESTED',
  bot: (pr) => Boolean(pr.bot),
}

/** One predicate per qualifier (Strategy as plain functions). */
const QUALIFIERS = {
  repo: (pr: Searchable, value: string) =>
    toLower(pr.repo) === toLower(value) || toLower(pr.repo.split('/')[1] ?? '') === toLower(value),
  author: (pr: Searchable, value: string) => toLower(pr.author) === toLower(stripAt(value)),
  head: (pr: Searchable, value: string) => pr.headRef === value,
  base: (pr: Searchable, value: string) => pr.baseRef === value,
  is: (pr: Searchable, value: string) => IS[toLower(value)]?.(pr) ?? false,
  'review-requested': (pr: Searchable) => pr.requested,
  'user-review-requested': (pr: Searchable) => pr.requested && !pr.viaTeam,
  'team-review-requested': (pr: Searchable, value: string) =>
    pr.requested && pr.viaTeam !== null && (value === '*' || toLower(pr.viaTeam) === toTeamSlug(value)),
} satisfies Record<string, (pr: Searchable, value: string) => boolean>

type FilterKey = keyof typeof QUALIFIERS

const REVIEW_KEYS: readonly FilterKey[] = ['review-requested', 'user-review-requested', 'team-review-requested']

const isFilterKey = (key: string): key is FilterKey => key in QUALIFIERS

const TOKEN = /(?<minus>-?)(?<key>[a-z][a-z-]*):(?<value>"[^"]*"|\S+)|"(?<quoted>[^"]*)"|(?<word>\S+)/giu

function toAudienceQualifier(audience: ReviewAudience): string | null {
  if (audience.kind === 'me') {
    return 'user-review-requested:@me'
  }
  if (audience.kind === 'team') {
    return `team-review-requested:${audience.team}`
  }
  return null
}

const isReviewToken = (token: string) =>
  REVIEW_KEYS.some((key) => toLower(token).replace(LEADING_MINUS, '').startsWith(`${key}:`))

/**
 * GitHub-style search for the inbox: free text plus qualifiers such as
 * `user-review-requested:@me`, `team-review-requested:web`, `repo:acme/web`, `author:ana`, `is:draft`, `-is:stale`.
 */
export interface InboxQuery {
  terms: string[]
  filters: Filter[]
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

export function parseQuery(text: string): InboxQuery {
  const query: InboxQuery = { terms: [], filters: [] }
  for (const match of text.matchAll(TOKEN)) {
    const { minus, key, value, quoted, word } = match.groups ?? {}
    if (key && value && isFilterKey(toLower(key))) {
      query.filters.push({ key: toLower(key) as FilterKey, value: value.replace(QUOTES, ''), negated: minus === '-' })
    } else {
      query.terms.push(toLower(quoted ?? word ?? match[0]))
    }
  }
  return query
}

export const isEmptyQuery = (query: InboxQuery) => !(query.terms.length > 0 || query.filters.length > 0)

export function matchesQuery(pr: Searchable, query: InboxQuery): boolean {
  const haystack = toLower(`${pr.repo} ${pr.title} ${pr.author} #${pr.number} ${pr.headRef} ${pr.text ?? ''}`)
  if (!query.terms.every((term) => haystack.includes(term))) {
    return false
  }
  return query.filters.every((filter) => QUALIFIERS[filter.key](pr, filter.value) !== filter.negated)
}

export function convertSummaryToSearchable(pr: PullSummary, requested: boolean): Searchable {
  return { ...pr, stacked: Boolean(pr.stack), requested, viaTeam: pr.viaTeam }
}

/** Stack members outside your inbox have no request; members inside it reuse the inbox row's team. */
export function convertStackPrToSearchable(pr: StackPr, inboxRow: PullSummary | undefined): Searchable {
  return { ...pr, stacked: true, requested: pr.inbox === 'requested', viaTeam: inboxRow?.viaTeam ?? null }
}

/** A thread searches by its PR's fields plus its file path and comments. Review-request qualifiers never match. */
export function convertThreadToSearchable(thread: OpenThread): Searchable {
  return {
    repo: thread.repo,
    title: thread.prTitle,
    author: thread.prAuthor,
    number: thread.number,
    headRef: '',
    baseRef: '',
    isDraft: thread.isDraft,
    stale: false,
    reviewDecision: null,
    stacked: false,
    requested: false,
    viaTeam: null,
    bot: Boolean(thread.comments.at(-1)?.bot),
    text: [thread.path, ...thread.comments.map((comment) => `${comment.author} ${comment.body}`)].join(' '),
  }
}

/** Who a review request is addressed to, as picked from the All / Me / team buttons. */
export type ReviewAudience = { kind: 'all' } | { kind: 'me' } | { kind: 'team'; team: string }

/** Replaces the review-request qualifiers in the query text, keeping everything else the user typed. */
export function applyAudience(text: string, audience: ReviewAudience): string {
  const kept = [...text.matchAll(TOKEN)].map((match) => match[0]).filter((token) => !isReviewToken(token))
  const tokens = [toAudienceQualifier(audience), ...kept].filter(isPresent)
  if (tokens.length === 0) {
    return ''
  }
  // A trailing space so typing goes on as a new term.
  return `${tokens.join(' ')} `
}

/** The audience the query currently selects, so the buttons can show which one is active. */
export function readAudience(query: InboxQuery): ReviewAudience | null {
  const review = query.filters.filter((filter) => REVIEW_KEYS.includes(filter.key))
  if (review.length === 0) {
    return { kind: 'all' }
  }
  const [only] = review
  if (review.length > 1 || only?.negated) {
    return null
  }
  if (only?.key === 'user-review-requested') {
    return { kind: 'me' }
  }
  if (only?.key === 'team-review-requested' && only?.value !== '*') {
    return { kind: 'team', team: toTeamSlug(only?.value) }
  }
  return null
}

/** Teams your open requests came through, with how many each, largest first. */
export function countTeams(requested: readonly PullSummary[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const pr of requested) {
    if (pr.viaTeam) {
      counts.set(pr.viaTeam, (counts.get(pr.viaTeam) ?? 0) + 1)
    }
  }
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
}
