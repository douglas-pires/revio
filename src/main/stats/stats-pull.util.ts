import { isPresent } from '@shared/presence.util.ts'
import type { StatsPull, StatsRequest, StatsReview } from '@shared/stats.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'

/** A PR as the stats query returns it. */
export interface RawStatsPull {
  number?: number
  title: string
  url: string
  createdAt: string
  mergedAt: string | null
  closedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
  author: { login: string } | null
  repository: { nameWithOwner: string }
  commits: { nodes: ({ commit: { authoredDate: string } } | null)[] }
  timelineItems: { nodes: (RawTimelineItem | null)[] }
  reviews: { nodes: (RawReview | null)[] } | null
}

type RawTimelineItem =
  | {
      __typename: 'ReviewRequestedEvent'
      createdAt: string
      requestedReviewer: { login?: string; slug?: string; organization?: { login: string } } | null
    }
  | { __typename: 'ReadyForReviewEvent'; createdAt: string }

interface RawReview {
  author: { login: string } | null
  state: StatsReview['state']
  submittedAt: string | null
  comments: { totalCount: number }
}

/** Who a request went to: a person's login, or "@org/slug" for a team; null when GitHub no longer says. */
function readRequestedReviewer(item: Extract<RawTimelineItem, { __typename: 'ReviewRequestedEvent' }>) {
  const reviewer = item.requestedReviewer
  if (reviewer?.login) {
    return reviewer.login
  }
  if (reviewer?.slug && reviewer.organization) {
    return `@${reviewer.organization.login}/${reviewer.slug}`
  }
  return null
}

function readRequests(items: RawTimelineItem[]): StatsRequest[] {
  return items.flatMap((item) => {
    if (item.__typename !== 'ReviewRequestedEvent') {
      return []
    }
    const reviewer = readRequestedReviewer(item)
    if (reviewer === null) {
      return []
    }
    return [{ reviewer, at: item.createdAt }]
  })
}

/** When the PR was opened for review: its last move out of draft, or when it was opened. */
function readReadyAt(createdAt: string, items: RawTimelineItem[]) {
  const ready = items.filter((item) => item.__typename === 'ReadyForReviewEvent').map((item) => item.createdAt)
  return ready.sort().at(-1) ?? createdAt
}

function readReviews(raw: RawStatsPull['reviews']): StatsReview[] {
  return (raw?.nodes ?? []).filter(isPresent).flatMap((review) => {
    if (!(review.submittedAt && review.author)) {
      return []
    }
    return [
      {
        reviewer: review.author.login,
        state: review.state,
        submittedAt: review.submittedAt,
        comments: review.comments.totalCount,
      },
    ]
  })
}

/** The PR in the shape the stats use; null for search results that are not PRs. */
export function toStatsPull(raw: RawStatsPull): StatsPull | null {
  if (raw.number === undefined) {
    return null
  }
  const items = raw.timelineItems.nodes.filter(isPresent)
  return {
    repo: raw.repository.nameWithOwner,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    author: raw.author?.login ?? 'ghost',
    createdAt: raw.createdAt,
    readyAt: readReadyAt(raw.createdAt, items),
    firstCommitAt: raw.commits.nodes.find(isPresent)?.commit.authoredDate ?? null,
    mergedAt: raw.mergedAt,
    closedAt: raw.closedAt,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    requests: readRequests(items),
    reviews: readReviews(raw.reviews),
  }
}

/** The longest search text GitHub accepts. */
const MAX_SEARCH_LENGTH = 256

/**
 * Searches for PRs matching any of `people` on one qualifier (GitHub ORs repeated `author:` or `reviewed-by:`),
 * split so each fits GitHub's length limit.
 */
export function buildPeopleSearches(qualifier: 'author' | 'reviewed-by', people: string[], rest: string) {
  const searches: string[] = []
  let current = rest
  for (const login of people) {
    const next = `${current} ${qualifier}:${login}`
    if (next.length > MAX_SEARCH_LENGTH && current !== rest) {
      searches.push(current)
      current = `${rest} ${qualifier}:${login}`
    } else {
      current = next
    }
  }
  if (current !== rest) {
    searches.push(current)
  }
  return searches
}

/** Days per search window: small enough to stay under GitHub's 1,000 results, many enough to search in parallel. */
const WINDOW_DAYS = 15

const toDay = (time: number) => new Date(time).toISOString().slice(0, 'yyyy-mm-dd'.length)

/** The period from `since` to `now` as date ranges for search ("2026-11-01..2026-11-15"), oldest first. */
export function splitIntoWindows(since: number, now: number) {
  const windows: string[] = []
  for (let start = since; start <= now; start += WINDOW_DAYS * MS_PER_DAY) {
    const end = Math.min(now, start + (WINDOW_DAYS - 1) * MS_PER_DAY)
    windows.push(`${toDay(start)}..${toDay(end)}`)
  }
  return windows
}
