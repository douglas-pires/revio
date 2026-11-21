import type { Octokit } from '@octokit/rest'
import type { ThreadComment, ThreadsInbox } from '@shared/thread.types.ts'
import { type RawThreadComment, type RawThreadPr, toThreadComment, triageThreads } from './thread-triage.util.ts'

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

interface Result {
  viewer: { login: string }
  search: { nodes: (RawThreadPr | Record<string, never> | null)[] }
}

const COMMENT_FIELDS = 'author { __typename login avatarUrl(size: 64) } body createdAt url'

export async function fetchThreads(octokit: Octokit): Promise<ThreadsInbox> {
  const data = await octokit.graphql<Result>(THREADS_QUERY, { q: SEARCH })
  const prs = data.search.nodes.filter((node): node is RawThreadPr => node !== null && 'reviewThreads' in node)
  return { threads: triageThreads(prs, data.viewer.login), fetchedAt: new Date().toISOString() }
}

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
  let mutation = 'unresolveReviewThread'
  if (resolved) {
    mutation = 'resolveReviewThread'
  }
  await octokit.graphql(`mutation ($id: ID!) { ${mutation}(input: { threadId: $id }) { thread { isResolved } } }`, {
    id: threadId,
  })
}
