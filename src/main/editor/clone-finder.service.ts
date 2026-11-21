import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { listRemoteUrls, readGitDir, readGithubRepo } from './local-clone.util.ts'

/** How many folders below a root a clone may sit: ~/Projects/acme/widgets is three below the home folder. */
const MAX_DEPTH = 3

/** Folders that never hold code and can be large, or are dependency or build trees inside a project. */
const SKIP = new Set([
  'Library',
  'Applications',
  'Movies',
  'Music',
  'Pictures',
  'Public',
  'node_modules',
  'vendor',
  'dist',
  'build',
])

/** The text of a file, or '' when it cannot be read. */
function readText(path: string) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

/** The config file of the git repository at `dir`: `.git/config`, or the main repository's for a linked worktree. */
function readGitConfig(directory: string): string {
  const dotGit = join(directory, '.git')
  if (statSync(dotGit).isDirectory()) {
    return readText(join(dotGit, 'config'))
  }
  const gitDir = readGitDir(readText(dotGit))
  if (!gitDir) {
    return ''
  }
  const common = readText(join(resolve(directory, gitDir), 'commondir')).trim() || '.'
  return readText(join(resolve(directory, gitDir), common, 'config'))
}

function listSubfolders(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !SKIP.has(entry.name))
      .map((entry) => join(directory, entry.name))
  } catch {
    return []
  }
}

/** Notes the clone at `dir` under each GitHub repository its remotes point at, unless one was found first. */
function recordClone(clones: Map<string, string>, directory: string) {
  for (const repo of listRemoteUrls(readGitConfig(directory)).map(readGithubRepo)) {
    if (repo && !clones.has(repo)) {
      clones.set(repo, directory)
    }
  }
}

/**
 * Every GitHub clone in `roots` and up to MAX_DEPTH folders below them, by `owner/name` (lowercased). Folders are
 * walked breadth first and a clone's own folders are not searched, so the shallowest clone of a repository wins.
 * Remotes are read from the git config files directly, without starting git.
 */
export function findClones(roots: readonly string[]): Map<string, string> {
  const clones = new Map<string, string>()
  let level = roots.filter((root) => existsSync(root))
  for (let depth = 0; depth <= MAX_DEPTH && level.length > 0; depth += 1) {
    const next: string[] = []
    for (const directory of level) {
      if (existsSync(join(directory, '.git'))) {
        recordClone(clones, directory)
      } else {
        next.push(...listSubfolders(directory))
      }
    }
    level = next
  }
  return clones
}
