import type { Branch, CiState, Commit, FileChange, FileChangeStatus, LogQuery } from '@shared/git-log.types.ts'

/** Field and record separators in `git log` output: characters a commit message never holds. */
const FIELD = '\u001f'
const RECORD = '\u001e'
const HASH_PREFIX = /^[0-9a-f]{7,40}$/iu
const TRACK = /(?<dir>ahead|behind) (?<n>\d+)/gu
const STATUSES = new Set<string>(['A', 'M', 'D', 'R', 'C', 'T'])
const HEAD_ARROW = /^HEAD -> /u
const LEADING_NEWLINE = /^\n/u

/** Decorations as `git log` prints them: "HEAD -> main, origin/main, tag: v1". */
function parseRefs(decoration: string): string[] {
  return decoration
    .split(', ')
    .map((r) => r.replace(HEAD_ARROW, '').trim())
    .filter((r) => r !== '' && r !== 'HEAD')
}

/** "[ahead 2, behind 1]" as numbers. */
function parseTrack(track: string) {
  const counts = { ahead: 0, behind: 0 }
  for (const m of track.matchAll(TRACK)) {
    const n = Number(m.groups?.n ?? 0)
    if (m.groups?.dir === 'ahead') {
      counts.ahead = n
    } else {
      counts.behind = n
    }
  }
  return counts
}

function toStatus(code: string): FileChangeStatus {
  const s = code.charAt(0)
  if (STATUSES.has(s)) {
    return s as FileChangeStatus
  }
  return 'M'
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

/** Arguments for `git log` from a query; `pageSize + 1` commits are asked for, to tell whether more follow. */
export function logArgs(q: LogQuery, pageSize: number): string[] {
  const args = ['log', `--format=${LOG_FORMAT}`, '--date-order', `--max-count=${pageSize + 1}`, `--skip=${q.skip}`]
  const text = q.text.trim()
  const author = q.author.trim()
  if ((text && !looksLikeHash(text)) || author) {
    args.push('--regexp-ignore-case', '--fixed-strings')
  }
  if (text && !looksLikeHash(text)) {
    args.push(`--grep=${text}`)
  }
  if (author) {
    args.push(`--author=${author}`)
  }
  if (q.sinceDays > 0) {
    args.push(`--since=${q.sinceDays}.days.ago`)
  }
  if (q.branch) {
    // `--end-of-options` keeps a branch named like an option from being read as one.
    args.push('--end-of-options', q.branch)
  } else {
    args.push('--all')
  }
  if (q.path.trim()) {
    args.push('--', q.path.trim())
  }
  return args
}

export function parseLog(out: string): Commit[] {
  return out
    .split(RECORD)
    .map((r) => r.replace(LEADING_NEWLINE, ''))
    .filter((r) => r.trim() !== '')
    .map((r) => {
      const [hash = '', parents = '', author = '', authorEmail = '', date = '', subject = '', refs = ''] =
        r.split(FIELD)
      return {
        hash,
        parents: parents.split(' ').filter(Boolean),
        author,
        authorEmail,
        date,
        subject,
        refs: parseRefs(refs),
      }
    })
}

/** Local and remote branches from `git for-each-ref refs/heads refs/remotes`, skipping `origin/HEAD`. */
export function parseBranches(out: string): Branch[] {
  return out
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line): Branch[] => {
      const [ref = '', head = '', track = ''] = line.split('\t')
      if (ref.startsWith('refs/heads/')) {
        return [{ name: ref.slice('refs/heads/'.length), kind: 'local', current: head === '*', ...parseTrack(track) }]
      }
      if (ref.startsWith('refs/remotes/') && !ref.endsWith('/HEAD')) {
        return [{ name: ref.slice('refs/remotes/'.length), kind: 'remote', current: false, ahead: 0, behind: 0 }]
      }
      return []
    })
}

/** `git show --name-status` lines: "M\tpath", "R087\told\tnew". */
export function parseNameStatus(lines: readonly string[]): FileChange[] {
  return lines
    .filter((l) => l.includes('\t'))
    .map((l) => {
      const [code = '', a = '', b] = l.split('\t')
      const status = toStatus(code)
      if (b !== undefined && (status === 'R' || status === 'C')) {
        return { status, path: b, from: a }
      }
      return { status, path: a }
    })
}

/** GitHub's rollup state for a commit's checks, as Revio shows it. */
export function toCiState(rollup: string | null | undefined): CiState {
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
