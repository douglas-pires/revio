import type { PullDetail, PullLocalState } from '@shared/pull.types.ts'

import { isGenerated } from '../common/format.util.ts'

import { parsePatch } from './diff.util.ts'

/** Roots whose second level is the unit people own, as in a monorepo. */
const MONOREPO_ROOTS = new Set(['apps', 'packages', 'services', 'libs', 'modules'])

/** The folder a file suggests a guide for: its top-level folder, or two levels under a monorepo root. */
function suggestFolder(parts: readonly string[]) {
  const [top, second] = parts
  if (parts.length < 2 || top === undefined) {
    return null
  }
  if (MONOREPO_ROOTS.has(top) && parts.length > 2) {
    return `${top}/${second}/`
  }
  return `${top}/`
}

export function groupByDir<T extends { path: string }>(files: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const file of files) {
    const dir = file.path.slice(0, file.path.lastIndexOf('/') + 1)
    groups.set(dir, [...(groups.get(dir) ?? []), file])
  }
  return [...groups.entries()]
}

/** Top-level folders a PR touches, two levels deep for monorepo-style roots (apps/, packages/, services/…). */
export function suggestFolders(paths: string[]) {
  const out = new Set<string>()
  for (const parts of paths.map((path) => path.split('/'))) {
    const folder = suggestFolder(parts)
    if (folder) {
      out.add(folder)
    }
  }
  return [...out]
}

/** Files start collapsed when already viewed at this version, marked skippable by Claude, or generated. */
export function computeInitialCollapsed(pr: PullDetail, local: PullLocalState): Record<string, boolean> {
  const ignore = new Set(local.briefing?.briefing.ignore.map((skipped) => skipped.path))
  return Object.fromEntries(
    pr.files.map((file) => [
      file.path,
      local.viewed[file.path] === file.sha || ignore.has(file.path) || isGenerated(file.path),
    ]),
  )
}

/** New-side line numbers present in each file's diff: where a RIGHT-side comment can attach. */
export function collectNewSideLines(pr: PullDetail | null): Map<string, Set<number>> {
  const lines = new Map<string, Set<number>>()
  for (const file of pr?.files ?? []) {
    const set = new Set<number>()
    if (file.patch) {
      for (const row of parsePatch(file.patch)) {
        if (row.kind !== 'hunk' && row.newNo !== null) {
          set.add(row.newNo)
        }
      }
    }
    lines.set(file.path, set)
  }
  return lines
}

/** A file's path, with where it came from when it was renamed. */
export function describeRename(file: { path: string; previousPath?: string | undefined }) {
  if (!file.previousPath) {
    return file.path
  }
  return `${file.previousPath} → ${file.path}`
}
