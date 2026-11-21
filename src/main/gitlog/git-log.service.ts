import type { Octokit } from '@octokit/rest'
import { readErrorMessage } from '@shared/error.util.ts'
import type {
  Branches,
  CiState,
  CommitCheck,
  CommitDetail,
  LocalRepo,
  LogPage,
  LogQuery,
  RawCheckContext,
} from '@shared/git-log.types.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { getGithubClient } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { assertCommitHash, runGit } from './git-command.service.ts'
import {
  BRANCH_FORMAT,
  buildLogArgs,
  extractFilePatch,
  LOG_FORMAT,
  looksLikeHash,
  parseBranches,
  parseCommitChecks,
  parseCommitDetail,
  parseLog,
  readCiState,
  SHOW_FORMAT,
} from './git-log.util.ts'

/** Commits per page of the log. */
const PAGE_SIZE = 200
/** Commits per GitHub query for CI states. */
const CI_COMMITS_PER_QUERY = 50

interface ChecksResponse {
  repository: {
    object: { statusCheckRollup: { contexts: { nodes: (RawCheckContext | null)[] } } | null } | null
  } | null
}

interface CiResponse {
  repository: Record<string, { statusCheckRollup: { state: string } | null } | null> | null
}

/** The commit a hash names, or none when no commit matches it. */
async function findCommitByHash(clonePath: string, hash: string) {
  const args = ['log', `--format=${LOG_FORMAT}`, '--max-count=1', '--end-of-options', hash]
  const output = await runGit(clonePath, args).catch(() => '')
  return parseLog(output)
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

/** Each commit's CI state on GitHub, by hash; commits GitHub does not know (not pushed) are 'none'. */
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

/** The clone of `repo`; only repositories found on disk can be used, never a path from the page. */
export function requireClone(editor: Pick<EditorService, 'findClone'>, repo: string): string {
  const clonePath = editor.findClone(repo)
  if (!clonePath) {
    throw new Error(`No local clone of ${repo} found. Add the folder that holds it under Settings → Editor.`)
  }
  return clonePath
}

/** A commit's checks on GitHub, failing first; none for a commit GitHub does not know (not pushed). */
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

/** Reads the log of your local clones. */
export class GitLogService {
  readonly #editor: EditorService

  constructor(editor: EditorService) {
    this.#editor = editor
  }

  /** Repositories with a clone on this Mac. */
  listRepos(): LocalRepo[] {
    return this.#editor.listClones()
  }

  #requireClone(repo: string): string {
    return requireClone(this.#editor, repo)
  }

  async readBranches(repo: string): Promise<Branches> {
    const args = ['for-each-ref', `--format=${BRANCH_FORMAT}`, 'refs/heads', 'refs/remotes']
    const branches = parseBranches(await runGit(this.#requireClone(repo), args))
    return { head: branches.find((branch) => branch.current)?.name ?? null, branches }
  }

  /** A page of the log; a search for a hash finds that one commit, wherever it is. */
  async readLog(repo: string, query: LogQuery): Promise<LogPage> {
    const clonePath = this.#requireClone(repo)
    const text = query.text.trim()
    if (looksLikeHash(text)) {
      return { commits: await findCommitByHash(clonePath, text), more: false }
    }
    const commits = parseLog(await runGit(clonePath, buildLogArgs(query, PAGE_SIZE)))
    return { commits: commits.slice(0, PAGE_SIZE), more: commits.length > PAGE_SIZE }
  }

  /** One file's changes in a commit (for a merge, against its first parent); '' for a binary file. */
  async readFilePatch(repo: string, hash: string, path: string): Promise<string> {
    assertCommitHash(hash)
    const args = ['show', '--format=', '--find-renames', '--diff-merges=first-parent', hash, '--', path]
    return extractFilePatch(await runGit(this.#requireClone(repo), args))
  }

  async readCommit(repo: string, hash: string): Promise<CommitDetail> {
    assertCommitHash(hash)
    const args = [
      'show',
      `--format=${SHOW_FORMAT}`,
      '--name-status',
      '--find-renames',
      '--diff-merges=first-parent',
      hash,
    ]
    return parseCommitDetail(hash, await runGit(this.#requireClone(repo), args))
  }
}
