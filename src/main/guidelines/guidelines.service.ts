import { randomUUID } from 'node:crypto'
import { buildDefaultTitle } from '@shared/guide-title.util.ts'
import type { Guideline, ResolvedGuideline } from '@shared/guideline.types.ts'
import type { GuideEntry } from '@shared/review-history.types.ts'
import { store } from '../store/store.service.ts'
import { appendGuideEntry } from './guide-entry.util.ts'

const EDGE_SLASHES = /^\/+|\/+$/gu

/** General first: all repositories, then a whole repository, then its folders. */
function rank(guideline: Guideline) {
  if (guideline.repo === '*') {
    return 0
  }
  if (guideline.path) {
    return 2
  }
  return 1
}

/** How many changed files a guideline covers: all of them, or those under its folder. */
function countMatches(guideline: Guideline, paths: string[]) {
  if (!guideline.path) {
    return paths.length
  }
  return paths.filter((path) => path.startsWith(guideline.path)).length
}

/** A guideline for every repository covers whole repositories, never a folder. */
function buildGuidelineFolder(repo: string, path: string) {
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
export const normalizePath = (path: string) => {
  const trimmed = path.trim().replace(EDGE_SLASHES, '')
  if (!trimmed) {
    return ''
  }
  return `${trimmed}/`
}

export function saveGuideline(input: Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }): Guideline {
  const list = store.guidelines()
  const repo = input.repo.trim() || '*'
  const guideline: Guideline = {
    ...input,
    repo,
    path: buildGuidelineFolder(repo, input.path),
    id: input.id ?? randomUUID(),
    updatedAt: new Date().toISOString(),
  }
  if (list.some((existing) => existing.id === guideline.id)) {
    store.setGuidelines(list.map((existing) => replaceIfSame(existing, guideline)))
  } else {
    store.setGuidelines([...list, guideline])
  }
  return guideline
}

/** Adds a bullet to the guide for the entry's repository and folder, starting that guide when there is none. */
export function addGuideEntry(entry: GuideEntry): Guideline {
  const repo = entry.repo.trim() || '*'
  const path = buildGuidelineFolder(repo, entry.path)
  const existing = store
    .guidelines()
    .find((guideline) => guideline.repo.toLowerCase() === repo.toLowerCase() && guideline.path === path)
  if (existing) {
    return saveGuideline({ ...existing, body: appendGuideEntry(existing.body, entry.text) })
  }
  return saveGuideline({
    repo,
    path,
    title: buildDefaultTitle({ repo, path }),
    body: appendGuideEntry('', entry.text),
    enabled: true,
  })
}

export function deleteGuideline(id: string) {
  store.setGuidelines(store.guidelines().filter((guideline) => guideline.id !== id))
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
  const repoName = repo.toLowerCase()
  return guidelines
    .filter((guideline) => guideline.enabled && (guideline.repo === '*' || guideline.repo.toLowerCase() === repoName))
    .map((guideline) => ({ ...guideline, matchedFiles: countMatches(guideline, paths) }))
    .filter((guideline) => guideline.matchedFiles > 0 || paths.length === 0)
    .sort((left, right) => rank(left) - rank(right) || left.path.length - right.path.length)
}

/** Where a guideline applies, in words: all repositories, a repository, or a folder in one. */
export function describeScope(guideline: Guideline) {
  if (guideline.repo === '*') {
    return 'All repositories'
  }
  if (guideline.path) {
    return `${guideline.repo} › ${guideline.path}`
  }
  return guideline.repo
}
