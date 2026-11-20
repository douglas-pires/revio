import { execFile } from 'node:child_process'
import { errorMessage } from '@shared/error.util.ts'
import type { Branches, CiState, CommitDetail, LocalRepo, LogPage, LogQuery } from '@shared/git-log.types.ts'
import { env } from '../common/env.config.ts'
import { shellPath } from '../common/shell.util.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { gh } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import {
  BRANCH_FORMAT,
  LOG_FORMAT,
  logArgs,
  looksLikeHash,
  parseBranches,
  parseLog,
  parseNameStatus,
  toCiState,
} from './git-log.util.ts'

/** Commits per page of the log. */
const PAGE_SIZE = 200
const GIT_TIMEOUT_MS = 20_000
const MAX_GIT_OUTPUT_BYTES = 52_428_800 // 50 MiB
/** Commits per GitHub query for CI states. */
const CI_CHUNK = 50
const HASH = /^[0-9a-f]{4,40}$/iu
const RECORD = '\u001e'
const FIELD = '\u001f'

/** Runs git in a clone and returns what it printed. Arguments go to git as they are, never through a shell. */
async function git(cwd: string, args: string[]): Promise<string> {
  const path = await shellPath()
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=off', '-c', 'color.ui=never', ...args],
      { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: MAX_GIT_OUTPUT_BYTES, env: { ...env, PATH: path } },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message))
        } else {
          resolve(stdout)
        }
      },
    )
  })
}

function checkHash(hash: string) {
  if (!HASH.test(hash)) {
    throw new Error(`Not a commit hash: ${hash}`)
  }
}

/** Each commit's CI state on GitHub, by hash; commits GitHub does not know (not pushed) are 'none'. */
export async function fetchCommitCi(repo: string, hashes: string[]): Promise<Record<string, CiState>> {
  for (const h of hashes) {
    checkHash(h)
  }
  const { owner, repo: name } = splitRepo(repo)
  const states: Record<string, CiState> = {}
  try {
    const octokit = await gh()
    for (let i = 0; i < hashes.length; i += CI_CHUNK) {
      const chunk = hashes.slice(i, i + CI_CHUNK)
      const fields = chunk.map((h, k) => `c${k}: object(oid: "${h}") { ... on Commit { statusCheckRollup { state } } }`)
      // biome-ignore lint/performance/noAwaitInLoops: one chunk at a time, to stay under GitHub's rate limits.
      const data = await octokit.graphql<{
        repository: Record<string, { statusCheckRollup: { state: string } | null } | null> | null
      }>(
        `query ($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields.join('\n')} } }`,
        { owner, name },
      )
      chunk.forEach((h, k) => {
        states[h] = toCiState(data.repository?.[`c${k}`]?.statusCheckRollup?.state)
      })
    }
  } catch (err) {
    console.error('[revio] CI lookup failed:', errorMessage(err))
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
  repos(): LocalRepo[] {
    return this.#editor.listClones()
  }

  /** The clone of `repo`; only repositories found on disk can be read, never a path from the page. */
  #clone(repo: string): string {
    const path = this.#editor.findClone(repo)
    if (!path) {
      throw new Error(`No local clone of ${repo} found. Add the folder that holds it under Settings → Editor.`)
    }
    return path
  }

  async branches(repo: string): Promise<Branches> {
    const out = await git(this.#clone(repo), [
      'for-each-ref',
      `--format=${BRANCH_FORMAT}`,
      'refs/heads',
      'refs/remotes',
    ])
    const branches = parseBranches(out)
    return { head: branches.find((b) => b.current)?.name ?? null, branches }
  }

  async log(repo: string, query: LogQuery): Promise<LogPage> {
    const cwd = this.#clone(repo)
    const text = query.text.trim()
    if (looksLikeHash(text)) {
      // A hash finds that one commit, wherever it is.
      const out = await git(cwd, ['log', `--format=${LOG_FORMAT}`, '--max-count=1', '--end-of-options', text]).catch(
        () => '',
      )
      return { commits: parseLog(out), more: false }
    }
    const commits = parseLog(await git(cwd, logArgs(query, PAGE_SIZE)))
    return { commits: commits.slice(0, PAGE_SIZE), more: commits.length > PAGE_SIZE }
  }

  async commit(repo: string, hash: string): Promise<CommitDetail> {
    checkHash(hash)
    const out = await git(this.#clone(repo), [
      'show',
      `--format=%an${FIELD}%ae${FIELD}%aI${FIELD}%cn${FIELD}%B${RECORD}`,
      '--name-status',
      '--find-renames',
      '--diff-merges=first-parent',
      hash,
    ])
    const [head = '', changes = ''] = out.split(RECORD)
    const [author = '', authorEmail = '', date = '', committer = '', message = ''] = head.split(FIELD)
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
}
