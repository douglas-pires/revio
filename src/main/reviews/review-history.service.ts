import type { Octokit } from '@octokit/rest'
import { isPresent } from '@shared/presence.util.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'

/** PRs per page; GitHub allows up to 100. */
const PAGE_SIZE = 100
/** GitHub search returns at most 1,000 results: ten pages, enough for a busy year. */
const MAX_PAGES = 10
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
      number title url repository { nameWithOwner }
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
        state: review.state,
        submittedAt: review.submittedAt,
        comments: review.comments.nodes.filter(isPresent),
      },
    ]
  })
}

/** The search for others' PRs you reviewed, updated within the last `days`. */
function buildSearch(days: number, now: number) {
  const since = new Date(now - days * MS_PER_DAY).toISOString().slice(0, 'yyyy-mm-dd'.length)
  return `is:pr reviewed-by:@me -author:@me updated:>=${since} sort:updated-desc`
}

/**
 * The reviews you sent in the last `days`, newest first. Found through search, because GitHub leaves reviews in
 * private organisation repositories out of your contribution history.
 */
export async function fetchReviewHistory(
  octokit: Octokit,
  login: string,
  days: number,
  now = Date.now(),
): Promise<PastReview[]> {
  const reviews: PastReview[] = []
  const search = buildSearch(days, now)
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const data: Data = await octokit.graphql<Data>(QUERY, { search, login, after })
    reviews.push(...data.search.nodes.filter(isPresent).flatMap(toPastReviews))
    if (!data.search.pageInfo.hasNextPage) {
      break
    }
    after = data.search.pageInfo.endCursor
  }
  // The search finds PRs updated in the period; reviews you sent on them before it are left out.
  const since = new Date(now - days * MS_PER_DAY).toISOString()
  return reviews
    .filter((review) => review.submittedAt >= since)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
}
