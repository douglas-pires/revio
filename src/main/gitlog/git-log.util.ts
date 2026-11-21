import type {
  CiState,
  Commit,
  CommitCheck,
  CommitDetail,
  FileChange,
  FileChangeStatus,
  PullLogQuery,
  RawCheckContext,
} from '@shared/git-log.types.ts'

const COMMIT_HASH = /^[0-9a-f]{4,40}$/iu
const PASSED_CONCLUSIONS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])
const DAY_MS = 86_400_000

/** GitHub's file statuses as the change letters the log shows. */
const CHANGE_STATUSES: Record<string, FileChangeStatus> = {
  added: 'A',
  removed: 'D',
  renamed: 'R',
  copied: 'C',
  changed: 'T',
}

/** A check run's result: running until completed, then passed (success, neutral, skipped) or failed. */
function readCheckRunState(status: string, conclusion: string | null): CiState {
  if (status !== 'COMPLETED') {
    return 'pending'
  }
  if (PASSED_CONCLUSIONS.has(conclusion ?? '')) {
    return 'success'
  }
  return 'failure'
}

/** Who wrote the commit: their GitHub login when GitHub links one, else the name in the commit. */
function readAuthor(commit: GithubCommit) {
  return commit.author?.login ?? commit.commit.author?.name ?? 'unknown'
}

/** A GitHub file status as a change letter; "modified" and anything unknown read as modified. */
function readChangeStatus(status: string | undefined): FileChangeStatus {
  return CHANGE_STATUSES[status ?? ''] ?? 'M'
}

function convertFileChange(file: NonNullable<GithubCommit['files']>[number]): FileChange {
  return { status: readChangeStatus(file.status), path: file.filename, from: file.previous_filename }
}

/** The parts of a commit GitHub's REST API returns (`repos.listCommits`, `repos.getCommit`) that the log reads. */
export interface GithubCommit {
  sha: string
  parents: { sha: string }[]
  author: { login: string } | null
  commit: {
    message: string
    author: { name?: string; email?: string; date?: string } | null
    committer: { name?: string; date?: string } | null
  }
  files?: { filename: string; status?: string; previous_filename?: string }[]
}

/** The date `days` days before `now`, for GitHub's `since`; undefined for any time (0). */
export function buildSinceDate(days: number, now: Date): string | undefined {
  if (days <= 0) {
    return
  }
  return new Date(now.getTime() - days * DAY_MS).toISOString()
}

/** The path, author and date filters as GitHub's `listCommits` takes them, leaving out the empty ones. */
export function buildCommitFilters(
  query: Pick<PullLogQuery, 'path' | 'author' | 'sinceDays'>,
  now: Date,
): { path?: string; author?: string; since?: string } {
  const filters: { path?: string; author?: string; since?: string } = {}
  const path = query.path.trim()
  const author = query.author.trim()
  const since = buildSinceDate(query.sinceDays, now)
  if (path) {
    filters.path = path
  }
  if (author) {
    filters.author = author
  }
  if (since) {
    filters.since = since
  }
  return filters
}

/** A commit from GitHub as a row of the log. */
export function convertCommit(commit: GithubCommit): Commit {
  return {
    hash: commit.sha,
    parents: commit.parents.map((parent) => parent.sha),
    author: readAuthor(commit),
    authorEmail: commit.commit.author?.email ?? '',
    date: commit.commit.author?.date ?? commit.commit.committer?.date ?? '',
    subject: commit.commit.message.split('\n')[0] ?? '',
    refs: [],
  }
}

/** A commit from GitHub, with its files, as the log's commit pane shows it. */
export function convertCommitDetail(commit: GithubCommit): CommitDetail {
  return {
    hash: commit.sha,
    message: commit.commit.message.trim(),
    author: readAuthor(commit),
    authorEmail: commit.commit.author?.email ?? '',
    date: commit.commit.author?.date ?? '',
    committer: commit.commit.committer?.name ?? '',
    files: (commit.files ?? []).map(convertFileChange),
  }
}

/** Fails unless `hash` looks like a commit hash, before it goes into a GitHub query. */
export function assertCommitHash(hash: string) {
  if (!COMMIT_HASH.test(hash)) {
    throw new Error(`Not a commit hash: ${hash}`)
  }
}

/** GitHub's rollup state for a commit's checks, as Revio shows it. */
export function readCiState(rollup: string | null | undefined): CiState {
  if (rollup === 'SUCCESS') {
    return 'success'
  }
  if (rollup === 'FAILURE' || rollup === 'ERROR') {
    return 'failure'
  }
  if (rollup === 'PENDING' || rollup === 'EXPECTED') {
    return 'pending'
  }
  return 'none'
}

/** The commit's checks as Revio shows them, failing ones first, then running, then passed, each by name. */
export function parseCommitChecks(contexts: readonly (RawCheckContext | null)[]): CommitCheck[] {
  const order: Record<CiState, number> = { failure: 0, pending: 1, success: 2, none: 3 }
  return contexts
    .filter((context): context is RawCheckContext => context !== null)
    .map((context) => {
      if (context.__typename === 'CheckRun') {
        return {
          name: context.name,
          state: readCheckRunState(context.status, context.conclusion),
          url: context.detailsUrl,
        }
      }
      return { name: context.context, state: readCiState(context.state), url: context.targetUrl }
    })
    .sort((left, right) => order[left.state] - order[right.state] || left.name.localeCompare(right.name))
}
