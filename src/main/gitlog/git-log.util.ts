import type {
  Branch,
  CiState,
  Commit,
  CommitCheck,
  CommitDetail,
  FileChange,
  FileChangeStatus,
  LogQuery,
  RawCheckContext,
} from '@shared/git-log.types.ts'

/** Field and record separators in `git log` output: characters a commit message never holds. */
const FIELD_SEPARATOR = '\u001f'
const RECORD_SEPARATOR = '\u001e'
const HASH_PREFIX = /^[0-9a-f]{7,40}$/iu
const TRACKING_COUNT = /(?<direction>ahead|behind) (?<count>\d+)/gu
const CHANGE_STATUSES = new Set<string>(['A', 'M', 'D', 'R', 'C', 'T'])
const HEAD_ARROW = /^HEAD -> /u
const LEADING_NEWLINE = /^\n/u
const FIRST_HUNK = /^@@ /mu
const PASSED_CONCLUSIONS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])
const LOCAL_BRANCH_PREFIX = 'refs/heads/'
const REMOTE_BRANCH_PREFIX = 'refs/remotes/'

/** Decorations as `git log` prints them: "HEAD -> main, origin/main, tag: v1". */
function parseRefs(decoration: string): string[] {
  return decoration
    .split(', ')
    .map((ref) => ref.replace(HEAD_ARROW, '').trim())
    .filter((ref) => ref !== '' && ref !== 'HEAD')
}

/** "[ahead 2, behind 1]" as numbers. */
function parseTrackingCounts(tracking: string) {
  const counts = { ahead: 0, behind: 0 }
  for (const match of tracking.matchAll(TRACKING_COUNT)) {
    const count = Number(match.groups?.count ?? 0)
    if (match.groups?.direction === 'ahead') {
      counts.ahead = count
    } else {
      counts.behind = count
    }
  }
  return counts
}

/** The change letter of a `--name-status` code ("R087" is a rename); anything unknown reads as modified. */
function readChangeStatus(code: string): FileChangeStatus {
  const letter = code.charAt(0)
  if (CHANGE_STATUSES.has(letter)) {
    return letter as FileChangeStatus
  }
  return 'M'
}

/** Whether the search text is a message search rather than a commit hash. */
function isMessageSearch(text: string) {
  return text !== '' && !HASH_PREFIX.test(text)
}

/** The message, author and date filters, as `git log` options. */
function buildFilterArgs(query: LogQuery): string[] {
  const text = query.text.trim()
  const author = query.author.trim()
  const args: string[] = []
  if (isMessageSearch(text) || author) {
    args.push('--regexp-ignore-case', '--fixed-strings')
  }
  if (isMessageSearch(text)) {
    args.push(`--grep=${text}`)
  }
  if (author) {
    args.push(`--author=${author}`)
  }
  if (query.sinceDays > 0) {
    args.push(`--since=${query.sinceDays}.days.ago`)
  }
  return args
}

/** One branch, or every branch when none is picked. */
function buildBranchArgs(branch: string): string[] {
  if (branch) {
    // `--end-of-options` keeps a branch named like an option from being read as one.
    return ['--end-of-options', branch]
  }
  return ['--all']
}

/** Which history to read: one branch or all of them, and only a path's commits when one is given. */
function buildRangeArgs(query: LogQuery): string[] {
  const range = buildBranchArgs(query.branch)
  const path = query.path.trim()
  if (path) {
    return [...range, '--', path]
  }
  return range
}

function parseCommitRecord(record: string): Commit {
  const [hash = '', parents = '', author = '', authorEmail = '', date = '', subject = '', refs = ''] =
    record.split(FIELD_SEPARATOR)
  return {
    hash,
    parents: parents.split(' ').filter(Boolean),
    author,
    authorEmail,
    date,
    subject,
    refs: parseRefs(refs),
  }
}

/** One `for-each-ref` line: a local branch with its tracking counts, a remote branch, or nothing (origin/HEAD). */
function parseBranchLine(line: string): Branch[] {
  const [ref = '', headMarker = '', tracking = ''] = line.split('\t')
  if (ref.startsWith(LOCAL_BRANCH_PREFIX)) {
    const name = ref.slice(LOCAL_BRANCH_PREFIX.length)
    return [{ name, kind: 'local', current: headMarker === '*', ...parseTrackingCounts(tracking) }]
  }
  if (ref.startsWith(REMOTE_BRANCH_PREFIX) && !ref.endsWith('/HEAD')) {
    return [{ name: ref.slice(REMOTE_BRANCH_PREFIX.length), kind: 'remote', current: false, ahead: 0, behind: 0 }]
  }
  return []
}

/** One `--name-status` line: "M\tpath", or "R087\told\tnew" for a rename. */
function parseChangeLine(line: string): FileChange {
  const [code = '', firstPath = '', secondPath] = line.split('\t')
  const status = readChangeStatus(code)
  if (secondPath !== undefined && (status === 'R' || status === 'C')) {
    return { status, path: secondPath, from: firstPath }
  }
  return { status, path: firstPath }
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

/** The `--format` that `parseLog` reads: hash, parents, author, email, date, subject, refs. */
export const LOG_FORMAT = `${['%H', '%P', '%an', '%ae', '%aI', '%s', '%D'].join('%x1f')}%x1e`

/** The `--format` that `parseBranches` reads, for `git for-each-ref`. */
// biome-ignore lint/security/noSecrets: a git format string, not a secret.
export const BRANCH_FORMAT = '%(refname)%09%(HEAD)%09%(upstream:track)'

/** Whether the search text could be a commit hash. */
export function looksLikeHash(text: string): boolean {
  return HASH_PREFIX.test(text.trim())
}

/**
 * Arguments for `git log` from a query; `pageSize + 1` commits are asked for, to tell whether more follow.
 * `--parents` rewrites each commit's parents to the nearest ones shown, so a path's history still draws as
 * connected lines rather than one lane per commit.
 */
export function buildLogArgs(query: LogQuery, pageSize: number): string[] {
  return [
    'log',
    `--format=${LOG_FORMAT}`,
    '--parents',
    '--date-order',
    `--max-count=${pageSize + 1}`,
    `--skip=${query.skip}`,
    ...buildFilterArgs(query),
    ...buildRangeArgs(query),
  ]
}

export function parseLog(output: string): Commit[] {
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.replace(LEADING_NEWLINE, ''))
    .filter((record) => record.trim() !== '')
    .map(parseCommitRecord)
}

/** Local and remote branches from `git for-each-ref refs/heads refs/remotes`, skipping `origin/HEAD`. */
export function parseBranches(output: string): Branch[] {
  return output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap(parseBranchLine)
}

/** `git show --name-status` lines: "M\tpath", "R087\told\tnew". */
export function parseNameStatus(lines: readonly string[]): FileChange[] {
  return lines.filter((line) => line.includes('\t')).map(parseChangeLine)
}

/** The `--format` that `parseCommitDetail` reads, for `git show`: author, email, date, committer, message. */
export const SHOW_FORMAT = `${['%an', '%ae', '%aI', '%cn', '%B'].join('%x1f')}%x1e`

/** A commit's details from `git show --format=SHOW_FORMAT --name-status`. */
export function parseCommitDetail(hash: string, output: string): CommitDetail {
  const [header = '', changes = ''] = output.split(RECORD_SEPARATOR)
  const [author = '', authorEmail = '', date = '', committer = '', message = ''] = header.split(FIELD_SEPARATOR)
  return {
    hash,
    message: message.trim(),
    author,
    authorEmail,
    date,
    committer,
    files: parseNameStatus(changes.split('\n')),
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

/** A file's patch from `git show --format= <hash> -- <path>`, from its first hunk on; '' when there is none (binary). */
export function extractFilePatch(output: string): string {
  const firstHunk = output.search(FIRST_HUNK)
  if (firstHunk < 0) {
    return ''
  }
  return output.slice(firstHunk).trimEnd()
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
