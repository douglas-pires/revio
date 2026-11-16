import type { Octokit } from '@octokit/rest'
import type { ThreadComment, ThreadsInbox } from '@shared/types'
import { InFlight } from './inFlight'
import { toThreadComment, triageThreads, type RawThreadComment, type RawThreadPr } from './threadTriage'

/** Open PRs you are involved in (author, commenter, mentioned, assigned), most recently updated first. */
const SEARCH = 'is:open is:pr archived:false involves:@me sort:updated-desc'

// Sizes keep one poll around 15 GraphQL rate-limit points.
const THREADS_QUERY = /* GraphQL */ `
  query ($q: String!) {
    viewer { login }
    search(query: $q, type: ISSUE, first: 30) {
      nodes {
        ... on PullRequest {
          number title url isDraft
          repository { nameWithOwner }
          author { __typename login avatarUrl(size: 64) }
          reviewThreads(first: 50) {
            nodes {
              id isResolved isOutdated path line
              comments(last: 10) {
                totalCount
                nodes { author { __typename login avatarUrl(size: 64) } body createdAt url }
              }
            }
          }
        }
      }
    }
  }
`

type Result = { viewer: { login: string }; search: { nodes: (RawThreadPr | Record<string, never> | null)[] } }

export async function fetchThreads(octokit: Octokit): Promise<ThreadsInbox> {
  const data = await octokit.graphql<Result>(THREADS_QUERY, { q: SEARCH })
  const prs = data.search.nodes.filter((n): n is RawThreadPr => !!n && 'reviewThreads' in n)
  return { threads: triageThreads(prs, data.viewer.login), fetchedAt: new Date().toISOString() }
}

const COMMENT_FIELDS = 'author { __typename login avatarUrl(size: 64) } body createdAt url'

/** Posts a reply in a review thread right away (not as part of a pending review). */
export async function replyToThread(octokit: Octokit, threadId: string, body: string): Promise<ThreadComment> {
  const data = await octokit.graphql<{ addPullRequestReviewThreadReply: { comment: RawThreadComment } }>(
    `mutation ($id: ID!, $body: String!) {
      addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $id, body: $body }) { comment { ${COMMENT_FIELDS} } }
    }`,
    { id: threadId, body },
  )
  return toThreadComment(data.addPullRequestReviewThreadReply.comment)
}

export async function setThreadResolved(octokit: Octokit, threadId: string, resolved: boolean): Promise<void> {
  const mutation = resolved ? 'resolveReviewThread' : 'unresolveReviewThread'
  await octokit.graphql(`mutation ($id: ID!) { ${mutation}(input: { threadId: $id }) { thread { isResolved } } }`, { id: threadId })
}

/** The last threads fetch, reused for `maxAgeMs`; concurrent callers share one request. */
export class ThreadFinder {
  #last: ThreadsInbox | null = null
  readonly #inFlight = new InFlight<ThreadsInbox>()
  readonly #load: () => Promise<ThreadsInbox>

  constructor(load: () => Promise<ThreadsInbox>) {
    this.#load = load
  }

  get(maxAgeMs = 0): Promise<ThreadsInbox> {
    const last = this.#last
    if (last && maxAgeMs > 0 && Date.now() - Date.parse(last.fetchedAt) <= maxAgeMs) return Promise.resolve(last)
    return this.#inFlight.run('threads', async () => (this.#last = await this.#load()))
  }

  /** Drops the cached copy after you change a thread, so the next read is fresh. */
  forget() {
    this.#last = null
  }
}
