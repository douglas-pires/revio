import type { Octokit } from '@octokit/rest'
import { isPresent } from '@shared/presence.util.ts'
import type { StatsData, StatsPeriod, StatsPull, StatsScope, StatsTeams } from '@shared/stats.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'
import { buildPeopleSearches, type RawStatsPull, splitIntoWindows, toStatsPull } from './stats-pull.util.ts'

/** Searches sent to GitHub at once: quicker for a team, gentle on its rate limits. */
const PARALLEL_SEARCHES = 4

/** Runs the jobs at most `limit` at a time; their results come back in the jobs' order. */
async function runAtMost<T>(limit: number, jobs: (() => Promise<T>)[]) {
  const results: T[] = new Array(jobs.length)
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++
      results[index] = await jobs[index]!()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker))
  return results
}

/** Tries after GitHub is busy (a 5xx or its HTML error page), and how long to wait before each. */
const RETRY_DELAYS_MS = [1000, 4000]

/** Whether a failure is GitHub being busy, which passes, rather than a bad query or token. */
function isBusy(failure: unknown) {
  const status = (failure as { status?: number }).status ?? 0
  return status >= 500 || String((failure as Error).message).includes('<!DOCTYPE html>')
}

/** Runs a request again after a pause when GitHub is busy, a few times before giving up. */
async function retryWhenBusy<T>(request: () => Promise<T>) {
  for (const delay of RETRY_DELAYS_MS) {
    try {
      return await request()
    } catch (failure) {
      if (!isBusy(failure)) {
        throw failure
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  try {
    return await request()
  } catch (failure) {
    if (isBusy(failure)) {
      throw new Error('GitHub is busy and did not answer. Try Refresh in a minute.')
    }
    throw failure
  }
}

/** PRs per page: each brings its reviews and requests, so pages stay small. */
const PAGE_SIZE = 50
/** GitHub search returns at most 1,000 results. */
const MAX_RESULTS = 1000

const PULL_FIELDS = `... on PullRequest {
  number title url createdAt mergedAt closedAt additions deletions changedFiles
  author { login } repository { nameWithOwner }
  commits(first: 1) { nodes { commit { authoredDate } } }
  timelineItems(first: 40, itemTypes: [REVIEW_REQUESTED_EVENT, READY_FOR_REVIEW_EVENT]) { nodes {
    __typename
    ... on ReviewRequestedEvent { createdAt requestedReviewer {
      ... on User { login } ... on Team { slug organization { login } }
    } }
    ... on ReadyForReviewEvent { createdAt }
  } }
  reviews(first: 60) { nodes { author { login } state submittedAt comments { totalCount } } }
}`

const SEARCH_QUERY = `query ($search: String!, $after: String) {
  search(query: $search, type: ISSUE, first: ${PAGE_SIZE}, after: $after) {
    issueCount pageInfo { hasNextPage endCursor }
    nodes { ${PULL_FIELDS} }
  }
}`

interface SearchData {
  search: {
    issueCount: number
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: (RawStatsPull | null)[]
  }
}

/** The PRs one search finds (GitHub stops at 1,000), and whether some were left out. */
async function searchPulls(octokit: Octokit, search: string) {
  const pulls: StatsPull[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_RESULTS / PAGE_SIZE; page++) {
    const data: SearchData = await retryWhenBusy(() => octokit.graphql<SearchData>(SEARCH_QUERY, { search, after }))
    pulls.push(...data.search.nodes.filter(isPresent).map(toStatsPull).filter(isPresent))
    if (!data.search.pageInfo.hasNextPage) {
      return { pulls, truncated: false }
    }
    after = data.search.pageInfo.endCursor
  }
  return { pulls, truncated: true }
}

/** The members of a team, by login. */
async function fetchTeamMembers(octokit: Octokit, org: string, slug: string) {
  const data = await octokit.graphql<{
    organization: { team: { members: { nodes: ({ login: string } | null)[] } } | null } | null
  }>(
    `query ($org: String!, $slug: String!) {
      organization(login: $org) { team(slug: $slug) { members(first: 100) { nodes { login } } } }
    }`,
    { org, slug },
  )
  const team = data.organization?.team
  if (!team) {
    throw new Error(`Could not read the members of @${org}/${slug}.`)
  }
  return team.members.nodes.filter(isPresent).map((member) => member.login)
}

/** Each search a scope needs for one window of the period. */
function planSearches(scope: StatsScope, people: string[], window: string) {
  const created = `is:pr created:${window}`
  if (scope.kind === 'repo') {
    return [`${created} repo:${scope.repo}`]
  }
  // PRs they reviewed include their own only when someone else reviewed too; the metrics leave self-reviews out.
  return [
    ...buildPeopleSearches('author', people, created),
    ...buildPeopleSearches('reviewed-by', people, `is:pr updated:${window}`),
  ]
}

/** Whose work a scope covers: you, the picked teams' members, or everyone (null) in a repository. */
async function readPeople(octokit: Octokit, scope: StatsScope, viewer: string) {
  if (scope.kind === 'me') {
    return [viewer]
  }
  if (scope.kind === 'team') {
    const members = await Promise.all(scope.teams.map((team) => fetchTeamMembers(octokit, team.org, team.slug)))
    return [...new Set(members.flat())].sort()
  }
  return null
}

/** The PRs behind a scope's stats over the last `days`: PRs its people opened, and PRs they reviewed. */
export async function fetchStats(
  octokit: Octokit,
  viewer: string,
  scope: StatsScope,
  days: StatsPeriod,
  now = Date.now(),
): Promise<StatsData> {
  const people = await readPeople(octokit, scope, viewer)
  const searches = splitIntoWindows(now - days * MS_PER_DAY, now).flatMap((window) =>
    planSearches(scope, people ?? [], window),
  )
  const results = await runAtMost(
    PARALLEL_SEARCHES,
    searches.map((search) => () => searchPulls(octokit, search)),
  )
  const byUrl = new Map(results.flatMap((found) => found.pulls).map((pull) => [pull.url, pull]))
  const truncated = results.some((found) => found.truncated)
  return { scope, days, viewer, people, pulls: [...byUrl.values()], truncated, fetchedAt: new Date(now).toISOString() }
}

/** The teams you are in, across your organisations. */
export async function fetchStatsTeams(octokit: Octokit, viewer: string): Promise<StatsTeams> {
  try {
    const data = await octokit.graphql<{
      viewer: {
        organizations: {
          nodes: ({ login: string; teams: { nodes: ({ slug: string; name: string } | null)[] } } | null)[]
        }
      }
    }>(
      `query ($login: String!) { viewer { organizations(first: 50) { nodes {
        login teams(first: 100, userLogins: [$login]) { nodes { slug name } }
      } } } }`,
      { login: viewer },
    )
    const teams = data.viewer.organizations.nodes
      .filter(isPresent)
      .flatMap((org) =>
        org.teams.nodes.filter(isPresent).map((team) => ({ org: org.login, slug: team.slug, name: team.name })),
      )
    return { teams, error: null }
  } catch {
    return { teams: [], error: 'Revio could not read your teams. The GitHub token needs the read:org scope.' }
  }
}
