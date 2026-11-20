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
export function leafName(name: string): string {
  return name.slice(name.lastIndexOf('/') + 1)
}

/** Branches nested by the folders in their names, folders first, each level sorted by name. */
export function branchTree(branches: readonly Branch[], name = '', path = ''): BranchFolder {
  let prefix = ''
  if (path) {
    prefix = `${path}/`
  }
  const direct: Branch[] = []
  const byFolder = new Map<string, Branch[]>()
  for (const b of branches) {
    const rest = b.name.slice(prefix.length)
    const slash = rest.indexOf('/')
    if (slash < 0) {
      direct.push(b)
    } else {
      const folder = rest.slice(0, slash)
      byFolder.set(folder, [...(byFolder.get(folder) ?? []), b])
    }
  }
  const folders = [...byFolder]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, inside]) => branchTree(inside, folder, `${prefix}${folder}`))
  return { name, path, folders, branches: direct.sort((a, b) => a.name.localeCompare(b.name)) }
}

/** Branches whose name contains `query`, ignoring case; all of them for an empty query. */
export function filterBranches(branches: readonly Branch[], query: string): Branch[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    return [...branches]
  }
  return branches.filter((b) => b.name.toLowerCase().includes(q))
}
