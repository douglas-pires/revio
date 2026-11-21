import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gitDirOf, githubRepoOf, remoteUrlsIn } from './local-clone.util.ts'

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
function gitConfigOf(dir: string): string {
  const dotGit = join(dir, '.git')
  if (statSync(dotGit).isDirectory()) {
    return readText(join(dotGit, 'config'))
  }
  const gitDir = gitDirOf(readText(dotGit))
  if (!gitDir) {
    return ''
  }
  const common = readText(join(resolve(dir, gitDir), 'commondir')).trim() || '.'
  return readText(join(resolve(dir, gitDir), common, 'config'))
}

function subfoldersOf(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !SKIP.has(entry.name))
      .map((entry) => join(dir, entry.name))
  } catch {
    return []
  }
}

/** Notes the clone at `dir` under each GitHub repository its remotes point at, unless one was found first. */
function recordClone(clones: Map<string, string>, dir: string) {
  for (const repo of remoteUrlsIn(gitConfigOf(dir)).map(githubRepoOf)) {
    if (repo && !clones.has(repo)) {
      clones.set(repo, dir)
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
    for (const dir of level) {
      if (existsSync(join(dir, '.git'))) {
        recordClone(clones, dir)
      } else {
        next.push(...subfoldersOf(dir))
      }
    }
    level = next
  }
  return clones
}
