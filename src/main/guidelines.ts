import { randomUUID } from 'node:crypto'
import type { Guideline, ResolvedGuideline } from '@shared/types'
import { store } from './store'

export const normalizePath = (p: string) => {
  const trimmed = p.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed ? `${trimmed}/` : ''
}

export function saveGuideline(input: Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }): Guideline {
  const list = store.guidelines()
  const g: Guideline = {
    ...input,
    repo: input.repo.trim() || '*',
    path: input.repo.trim() === '*' ? '' : normalizePath(input.path),
    id: input.id ?? randomUUID(),
    updatedAt: new Date().toISOString(),
  }
  const idx = list.findIndex((x) => x.id === g.id)
  store.setGuidelines(idx >= 0 ? list.map((x) => (x.id === g.id ? g : x)) : [...list, g])
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
    .map((g) => ({ ...g, matchedFiles: g.path ? paths.filter((p) => p.startsWith(g.path)).length : paths.length }))
    .filter((g) => g.matchedFiles > 0 || paths.length === 0)
    .sort((a, b) => rank(a) - rank(b) || a.path.length - b.path.length)
}

const rank = (g: Guideline) => (g.repo === '*' ? 0 : g.path ? 2 : 1)

export const scopeLabel = (g: Guideline) => (g.repo === '*' ? 'All repositories' : g.path ? `${g.repo} › ${g.path}` : g.repo)
