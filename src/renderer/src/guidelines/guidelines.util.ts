import type { Guideline } from '@shared/guideline.types.ts'

const ALL_REPOSITORIES = 'All repositories'

const groupNameOf = (guideline: Guideline) => {
  if (guideline.repo === '*') {
    return ALL_REPOSITORIES
  }
  return guideline.repo
}

/** "All repositories" first, then repositories by name. */
function compareGroupNames(left: string, right: string) {
  if (left === ALL_REPOSITORIES) {
    return -1
  }
  if (right === ALL_REPOSITORIES) {
    return 1
  }
  return left.localeCompare(right)
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
export function makeNewDraft(repo: string, path = ''): Draft {
  return { repo, path, title: '', body: TEMPLATE, enabled: true }
}

/** Guides grouped by repository for the list, each group sorted by folder. */
export function groupGuides(list: readonly Guideline[]): [string, Guideline[]][] {
  const groups = new Map<string, Guideline[]>()
  for (const guideline of [...list].sort((left, right) => left.path.localeCompare(right.path))) {
    const name = groupNameOf(guideline)
    groups.set(name, [...(groups.get(name) ?? []), guideline])
  }
  return [...groups.entries()].sort(([leftName], [rightName]) => compareGroupNames(leftName, rightName))
}
