import type { Branch } from '@shared/git-log.types.ts'

/** A folder of branches, as names split on "/": `douglas/fix-x` sits in the `douglas` folder. */
export interface BranchFolder {
  name: string
  /** Its full path, as a key: `origin/douglas`. */
  path: string
  folders: BranchFolder[]
  branches: Branch[]
}

/** The label a branch shows inside its folder: the part after the last "/". */
export function readLeafName(name: string): string {
  return name.slice(name.lastIndexOf('/') + 1)
}

/** Branches nested by the folders in their names, folders first, each level sorted by name. */
export function buildBranchTree(branches: readonly Branch[], name = '', path = ''): BranchFolder {
  let prefix = ''
  if (path) {
    prefix = `${path}/`
  }
  const direct: Branch[] = []
  const byFolder = new Map<string, Branch[]>()
  for (const branch of branches) {
    const rest = branch.name.slice(prefix.length)
    const slash = rest.indexOf('/')
    if (slash < 0) {
      direct.push(branch)
    } else {
      const folder = rest.slice(0, slash)
      byFolder.set(folder, [...(byFolder.get(folder) ?? []), branch])
    }
  }
  const folders = [...byFolder]
    .sort(([leftFolder], [rightFolder]) => leftFolder.localeCompare(rightFolder))
    .map(([folder, inside]) => buildBranchTree(inside, folder, `${prefix}${folder}`))
  return { name, path, folders, branches: direct.sort((left, right) => left.name.localeCompare(right.name)) }
}

/** Branches whose name contains `query`, ignoring case; all of them for an empty query. */
export function filterBranches(branches: readonly Branch[], query: string): Branch[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return [...branches]
  }
  return branches.filter((branch) => branch.name.toLowerCase().includes(needle))
}
