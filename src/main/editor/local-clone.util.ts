import { isAbsolute, relative, resolve } from 'node:path'

const GITHUB_REMOTE = /github\.com[:/]+(?<owner>[^/]+)\/(?<name>[^/]+?)(?:\.git)?\/?$/iu
const REMOTE_SECTION = /^\[remote\s+"[^"]*"\]$/u
const REMOTE_URL = /^url\s*=\s*(?<url>\S+)/u
const GIT_DIR_LINE = /^gitdir:\s*(?<dir>.+?)\s*$/mu

/** The remote URLs in a git config file (`url = …` lines inside `[remote "…"]` sections). */
export function remoteUrlsIn(gitConfig: string): string[] {
  const urls: string[] = []
  let inRemote = false
  for (const raw of gitConfig.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('[')) {
      inRemote = REMOTE_SECTION.test(line)
    } else if (inRemote) {
      const url = REMOTE_URL.exec(line)?.groups?.url
      if (url) {
        urls.push(url)
      }
    }
  }
  return urls
}

/** The `owner/name` a remote URL points at on GitHub, lowercased, or null for other hosts. */
export function githubRepoOf(url: string): string | null {
  const groups = GITHUB_REMOTE.exec(url.trim())?.groups
  if (!groups) {
    return null
  }
  return `${groups.owner}/${groups.name}`.toLowerCase()
}

/** Where a linked worktree's `.git` file points (`gitdir: …`), or null when it is not one. */
export function gitDirOf(dotGitFile: string): string | null {
  return GIT_DIR_LINE.exec(dotGitFile)?.groups?.dir ?? null
}

/** The absolute path of `path` inside `clone`, or null if it would point outside it. */
export function pathInside(clone: string, path: string): string | null {
  if (!path || isAbsolute(path)) {
    return null
  }
  const full = resolve(clone, path)
  const rel = relative(clone, full)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    return null
  }
  return full
}

export const REPO_NAME = /^[\w.-]+\/[\w.-]+$/u
