import type { Octokit } from '@octokit/rest'
import { readErrorMessage } from '@shared/error.util.ts'
import type {
  CiState,
  CommitCheck,
  CommitDetail,
  LogPage,
  PullLogQuery,
  RawCheckContext,
} from '@shared/git-log.types.ts'
import { getGithubClient } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import {
  assertCommitHash,
  buildCommitFilters,
  convertCommit,
  convertCommitDetail,
  filterByMessage,
  type GithubCommit,
  looksLikeHash,
  parseCommitChecks,
  readCiState,
} from './git-log.util.ts'

/** Commits per page of the log (GitHub's most per request). */
const PAGE_SIZE = 100
/** Commits per GitHub query for CI states. */
const CI_COMMITS_PER_QUERY = 50
/** Files GitHub lists for a commit at most. */
const COMMIT_FILES_LIMIT = 300

interface ChecksResponse {
  repository: {
    object: { statusCheckRollup: { contexts: { nodes: (RawCheckContext | null)[] } } | null } | null
  } | null
}

interface CiResponse {
  repository: Record<string, { statusCheckRollup: { state: string } | null } | null> | null
}

/** The commit a hash (or the start of one) names, or none when GitHub knows no such commit. */
async function findCommitByHash(octokit: Octokit, repo: string, hash: string): Promise<LogPage> {
  const { owner, repo: name } = splitRepo(repo)
  try {
    const { data } = await octokit.repos.getCommit({ owner, repo: name, ref: hash, per_page: 1 })
    return { commits: [convertCommit(data as GithubCommit)], more: false }
  } catch {
    return { commits: [], more: false }
  }
}

/** One GitHub query for the CI state of up to `CI_COMMITS_PER_QUERY` commits, by hash. */
async function fetchCiBatch(octokit: Octokit, repo: string, hashes: readonly string[]) {
  const { owner, repo: name } = splitRepo(repo)
  const commitQueries = hashes.map(
    (hash, index) => `c${index}: object(oid: "${hash}") { ... on Commit { statusCheckRollup { state } } }`,
  )
  const response = await octokit.graphql<CiResponse>(
    `query ($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${commitQueries.join('\n')} } }`,
    { owner, name },
  )
  return hashes.map((hash, index) => [hash, readCiState(response.repository?.[`c${index}`]?.statusCheckRollup?.state)])
}

/**
 * A page of the history GitHub has from `query.sha`, filtered by path, author and date on GitHub. GitHub cannot
 * search messages, so text filters the page it returns; a search for a hash finds that one commit.
 */
export async function fetchPullLog(octokit: Octokit, repo: string, query: PullLogQuery): Promise<LogPage> {
  const text = query.text.trim()
  if (looksLikeHash(text)) {
    return findCommitByHash(octokit, repo, text)
  }
  const { owner, repo: name } = splitRepo(repo)
  const { data } = await octokit.repos.listCommits({
    owner,
    repo: name,
    sha: query.sha,
    ...buildCommitFilters(query, new Date()),
    per_page: PAGE_SIZE,
    page: query.page,
  })
  const commits = filterByMessage(data as GithubCommit[], text).map(convertCommit)
  return { commits, more: data.length === PAGE_SIZE }
}

/** A commit's message, author and changed files, from GitHub. */
export async function fetchCommitDetail(octokit: Octokit, repo: string, hash: string): Promise<CommitDetail> {
  assertCommitHash(hash)
  const { owner, repo: name } = splitRepo(repo)
  const { data } = await octokit.repos.getCommit({ owner, repo: name, ref: hash, per_page: COMMIT_FILES_LIMIT })
  return convertCommitDetail(data as GithubCommit)
}

/** Each commit's CI state on GitHub, by hash; commits GitHub has no checks for are 'none'. */
export async function fetchCommitCi(repo: string, hashes: string[]): Promise<Record<string, CiState>> {
  for (const hash of hashes) {
    assertCommitHash(hash)
  }
  const states: Record<string, CiState> = {}
  try {
    const octokit = await getGithubClient()
    for (let start = 0; start < hashes.length; start += CI_COMMITS_PER_QUERY) {
      // biome-ignore lint/performance/noAwaitInLoops: one batch at a time, to stay under GitHub's rate limits.
      const batch = await fetchCiBatch(octokit, repo, hashes.slice(start, start + CI_COMMITS_PER_QUERY))
      Object.assign(states, Object.fromEntries(batch))
    }
  } catch (failure) {
    console.error('[revio] CI lookup failed:', readErrorMessage(failure))
  }
  return states
}

/** A commit's checks on GitHub, failing first. */
export async function fetchCommitChecks(repo: string, hash: string): Promise<CommitCheck[]> {
  assertCommitHash(hash)
  const { owner, repo: name } = splitRepo(repo)
  const octokit = await getGithubClient()
  const response = await octokit.graphql<ChecksResponse>(
    `query ($owner: String!, $name: String!, $oid: GitObjectID!) { repository(owner: $owner, name: $name) {
      object(oid: $oid) { ... on Commit { statusCheckRollup { contexts(first: 100) { nodes {
        __typename
        ... on CheckRun { name status conclusion detailsUrl }
        ... on StatusContext { context state targetUrl }
      } } } } }
    } }`,
    { owner, name, oid: hash },
  )
  return parseCommitChecks(response.repository?.object?.statusCheckRollup?.contexts.nodes ?? [])
}
