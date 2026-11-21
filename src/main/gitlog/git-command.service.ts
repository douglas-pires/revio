import { runWithInput } from '../common/shell.util.ts'

const GIT_TIMEOUT_MS = 20_000
const COMMIT_HASH = /^[0-9a-f]{4,40}$/iu

/** Runs git in a clone and returns what it printed. Arguments go to git as they are, never through a shell. */
export function runGit(clonePath: string, args: string[]): Promise<string> {
  return runWithInput('git', ['-c', 'core.quotepath=off', '-c', 'color.ui=never', ...args], '', {
    cwd: clonePath,
    timeoutMs: GIT_TIMEOUT_MS,
  })
}

/** Fails unless `hash` looks like a commit hash, before it reaches a git command. */
export function assertCommitHash(hash: string) {
  if (!COMMIT_HASH.test(hash)) {
    throw new Error(`Not a commit hash: ${hash}`)
  }
}
