import type { Guideline } from '@shared/guideline.types.ts'

const TRAILING_SLASH = /\/$/u

const ALL_REPOSITORIES = 'All repositories'

const groupNameOf = (g: Guideline) => {
  if (g.repo === '*') {
    return ALL_REPOSITORIES
  }
  return g.repo
}

/** "All repositories" first, then repositories by name. */
function byGroupName(a: string, b: string) {
  if (a === ALL_REPOSITORIES) {
    return -1
  }
  if (b === ALL_REPOSITORIES) {
    return 1
  }
  return a.localeCompare(b)
}

/** A guide being edited: a saved one, or a new one without an id yet. */
export type Draft = Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }

export const TEMPLATE = `## Context
What this project/folder is and who owns it.

## Focus on
-

## Safe to skip
-

## House rules
-
`

/** A new guide for `repo` (and optionally a folder in it), starting from the template. */
export function newDraft(repo: string, path = ''): Draft {
  return { repo, path, title: '', body: TEMPLATE, enabled: true }
}

/** The title a guide gets when left blank: Global, its folder, or its repository's name. */
export function defaultTitle(d: Draft) {
  if (d.repo === '*') {
    return 'Global'
  }
  if (d.path) {
    return d.path.replace(TRAILING_SLASH, '')
  }
  return d.repo.split('/')[1] || 'Guide'
}

/** Guides grouped by repository for the list, each group sorted by folder. */
export function groupGuides(list: readonly Guideline[]): [string, Guideline[]][] {
  const groups = new Map<string, Guideline[]>()
  for (const g of [...list].sort((a, b) => a.path.localeCompare(b.path))) {
    const name = groupNameOf(g)
    groups.set(name, [...(groups.get(name) ?? []), g])
  }
  return [...groups.entries()].sort(([a], [b]) => byGroupName(a, b))
}
