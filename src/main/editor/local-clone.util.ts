import { isAbsolute, join, relative, resolve } from 'node:path'

/** Whether a git remote URL points at `owner/name` on GitHub (https or ssh, with or without .git). */
export function remotePointsAt(url: string, repo: string): boolean {
  const m = /github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(url.trim())
  return !!m && `${m[1]}/${m[2]}`.toLowerCase() === repo.toLowerCase()
}

/** Folders that may hold a clone of `owner/name` under `root`: root/name, root/owner/name and one level deeper. */
export function cloneCandidates(root: string, repo: string, subfolders: readonly string[]): string[] {
  const [owner, name] = repo.split('/') as [string, string]
  const under = (dir: string) => [join(dir, name), join(dir, owner, name)]
  return [...under(root), ...subfolders.flatMap((d) => under(join(root, d)))]
}

/** The absolute path of `path` inside `clone`, or null if it would point outside it. */
export function pathInside(clone: string, path: string): string | null {
  if (!path || isAbsolute(path)) return null
  const full = resolve(clone, path)
  const rel = relative(clone, full)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? full : null
}

export const REPO_NAME = /^[\w.-]+\/[\w.-]+$/
