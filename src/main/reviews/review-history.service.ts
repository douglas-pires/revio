import type { Octokit } from '@octokit/rest'
import { isPresent } from '@shared/presence.util.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'

/** PRs per page; GitHub allows up to 100. */
const PAGE_SIZE = 100
/** At most this many pages of PRs. */
const MAX_PAGES = 3
/** How far back to look. */
const LOOKBACK_DAYS = 365
/** Your reviews read per PR, and comments per review. */
const REVIEWS_PER_PULL = 20
const COMMENTS_PER_REVIEW = 50

interface RawReview {
  state: PastReview['state']
  submittedAt: string | null
  comments: { nodes: ({ body: string; path: string; url: string; createdAt: string } | null)[] }
}

interface RawPull {
  number?: number
  title: string
  url: string
  mergedAt: string | null
  author: { login: string } | null
  repository: { nameWithOwner: string }
  reviews: { nodes: (RawReview | null)[] } | null
}

interface Data {
  search: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: (RawPull | null)[]
  }
}

const QUERY = `query ($search: String!, $login: String!, $after: String) {
  search(query: $search, type: ISSUE, first: ${PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest {
      number title url mergedAt author { login } repository { nameWithOwner }
      reviews(author: $login, first: ${REVIEWS_PER_PULL}) { nodes {
        state submittedAt
        comments(first: ${COMMENTS_PER_REVIEW}) { nodes { body path url createdAt } }
      } }
    } }
  }
}`

/** Each review you sent on one PR, as a past review. */
function toPastReviews(pull: RawPull): PastReview[] {
  const { number } = pull
  if (number === undefined) {
    return []
  }
  return (pull.reviews?.nodes ?? []).filter(isPresent).flatMap((review) => {
    if (!review.submittedAt) {
      return []
    }
    return [
      {
        repo: pull.repository.nameWithOwner,
        number,
        title: pull.title,
        url: pull.url,
        author: pull.author?.login ?? 'ghost',
        mergedAt: pull.mergedAt,
        state: review.state,
        submittedAt: review.submittedAt,
        comments: review.comments.nodes.filter(isPresent),
      },
    ]
  })
}

/** The search for others' PRs you reviewed, updated within the last year. */
function buildSearch(now: number) {
  const since = new Date(now - LOOKBACK_DAYS * MS_PER_DAY).toISOString().slice(0, 'yyyy-mm-dd'.length)
  return `is:pr reviewed-by:@me -author:@me updated:>=${since} sort:updated-desc`
}

/**
 * The reviews you sent in the last year, newest first. Found through search, because GitHub leaves reviews in
 * private organisation repositories out of your contribution history.
 */
export async function fetchReviewHistory(octokit: Octokit, login: string, now = Date.now()): Promise<PastReview[]> {
  const reviews: PastReview[] = []
  const search = buildSearch(now)
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const data: Data = await octokit.graphql<Data>(QUERY, { search, login, after })
    reviews.push(...data.search.nodes.filter(isPresent).flatMap(toPastReviews))
    if (!data.search.pageInfo.hasNextPage) {
      break
    }
    after = data.search.pageInfo.endCursor
  }
  return reviews.sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
}
