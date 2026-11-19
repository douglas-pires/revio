import { randomUUID } from 'node:crypto'
import type { Guideline, ResolvedGuideline } from '@shared/guideline.types.ts'
import { store } from '../store/store.service.ts'

const EDGE_SLASHES = /^\/+|\/+$/gu

/** General first: all repositories, then a whole repository, then its folders. */
function rank(g: Guideline) {
  if (g.repo === '*') {
    return 0
  }
  if (g.path) {
    return 2
  }
  return 1
}

/** How many changed files a guideline covers: all of them, or those under its folder. */
function countMatches(g: Guideline, paths: string[]) {
  if (!g.path) {
    return paths.length
  }
  return paths.filter((p) => p.startsWith(g.path)).length
}

/** A guideline for every repository covers whole repositories, never a folder. */
function folderFor(repo: string, path: string) {
  if (repo === '*') {
    return ''
  }
  return normalizePath(path)
}

const replaceIfSame = (current: Guideline, saved: Guideline) => {
  if (current.id === saved.id) {
    return saved
  }
  return current
}

/** A folder as stored on a guideline: no leading slash, one trailing slash, or '' for the whole repository. */
export const normalizePath = (p: string) => {
  const trimmed = p.trim().replace(EDGE_SLASHES, '')
  if (!trimmed) {
    return ''
  }
  return `${trimmed}/`
}

export function saveGuideline(input: Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }): Guideline {
  const list = store.guidelines()
  const repo = input.repo.trim() || '*'
  const g: Guideline = {
    ...input,
    repo,
    path: folderFor(repo, input.path),
    id: input.id ?? randomUUID(),
    updatedAt: new Date().toISOString(),
  }
  if (list.some((x) => x.id === g.id)) {
    store.setGuidelines(list.map((x) => replaceIfSame(x, g)))
  } else {
    store.setGuidelines([...list, g])
  }
  return g
}

export function deleteGuideline(id: string) {
  store.setGuidelines(store.guidelines().filter((g) => g.id !== id))
}

/**
 * Guidelines that apply to a PR, ordered from general to specific:
 * global → repo root → each matching folder (shallow → deep).
 * A folder guideline only applies when at least one changed file lives under it.
 */
export function resolveGuidelines(repo: string, paths: string[]): ResolvedGuideline[] {
  return matchGuidelines(store.guidelines(), repo, paths)
}

export function matchGuidelines(guidelines: readonly Guideline[], repo: string, paths: string[]): ResolvedGuideline[] {
  const r = repo.toLowerCase()
  return guidelines
    .filter((g) => g.enabled && (g.repo === '*' || g.repo.toLowerCase() === r))
    .map((g) => ({ ...g, matchedFiles: countMatches(g, paths) }))
    .filter((g) => g.matchedFiles > 0 || paths.length === 0)
    .sort((a, b) => rank(a) - rank(b) || a.path.length - b.path.length)
}

/** Where a guideline applies, in words: all repositories, a repository, or a folder in one. */
export function scopeLabel(g: Guideline) {
  if (g.repo === '*') {
    return 'All repositories'
  }
  if (g.path) {
    return `${g.repo} › ${g.path}`
  }
  return g.repo
}
