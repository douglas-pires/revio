import type { Octokit } from '@octokit/rest'

/** How long to wait before asking GitHub again after it failed to answer. */
const RETRY_DELAY_MS = 2000
const SERVER_ERROR = 500

/** The HTTP status a failed request carries, or 0 when it has none. */
function readStatus(failure: unknown) {
  if (typeof failure === 'object' && failure !== null && 'status' in failure) {
    return Number(failure.status)
  }
  return 0
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A GraphQL request that GitHub gets a second chance at when it fails on its side (a 502 or a timeout on a heavy
 * query), then fails with a sentence to show rather than GitHub's error page.
 */
export async function queryWithRetry<T>(octokit: Octokit, query: string, variables: Record<string, unknown> = {}) {
  try {
    return await octokit.graphql<T>(query, variables)
  } catch (failure) {
    if (readStatus(failure) < SERVER_ERROR) {
      throw failure
    }
    await wait(RETRY_DELAY_MS)
    try {
      return await octokit.graphql<T>(query, variables)
    } catch (secondFailure) {
      if (readStatus(secondFailure) < SERVER_ERROR) {
        throw secondFailure
      }
      throw new Error('GitHub took too long to answer. Try again in a moment, or pick a shorter period.', {
        cause: secondFailure,
      })
    }
  }
}
