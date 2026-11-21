import type { Octokit } from '@octokit/rest'
import { readErrorMessage } from '@shared/error.util.ts'
import type { Branches, CiState, CommitDetail, LocalRepo, LogPage, LogQuery } from '@shared/git-log.types.ts'
import { runWithInput } from '../common/shell.util.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { getGithubClient } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import {
  BRANCH_FORMAT,
  buildLogArgs,
  LOG_FORMAT,
  looksLikeHash,
  parseBranches,
  parseCommitDetail,
  parseLog,
  readCiState,
  SHOW_FORMAT,
} from './git-log.util.ts'

/** Commits per page of the log. */
const PAGE_SIZE = 200
const GIT_TIMEOUT_MS = 20_000
/** Commits per GitHub query for CI states. */
const CI_COMMITS_PER_QUERY = 50
const COMMIT_HASH = /^[0-9a-f]{4,40}$/iu

interface CiResponse {
  repository: Record<string, { statusCheckRollup: { state: string } | null } | null> | null
}

/** Runs git in a clone and returns what it printed. Arguments go to git as they are, never through a shell. */
function runGit(clonePath: string, args: string[]): Promise<string> {
  return runWithInput('git', ['-c', 'core.quotepath=off', '-c', 'color.ui=never', ...args], '', {
    cwd: clonePath,
    timeoutMs: GIT_TIMEOUT_MS,
  })
}

function assertCommitHash(hash: string) {
  if (!COMMIT_HASH.test(hash)) {
    throw new Error(`Not a commit hash: ${hash}`)
  }
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

  /** The clone of `repo`; only repositories found on disk can be read, never a path from the page. */
  #requireClone(repo: string): string {
    const clonePath = this.#editor.findClone(repo)
    if (!clonePath) {
      throw new Error(`No local clone of ${repo} found. Add the folder that holds it under Settings → Editor.`)
    }
    return clonePath
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
