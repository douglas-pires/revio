import type { PullDetail, PullLocalState } from '@shared/pull.types.ts'

import { isGenerated } from '../common/format.util.ts'

import { parsePatch } from './diff.util.ts'

/** Roots whose second level is the unit people own, as in a monorepo. */
const MONOREPO_ROOTS = new Set(['apps', 'packages', 'services', 'libs', 'modules'])

/** The folder a file suggests a guide for: its top-level folder, or two levels under a monorepo root. */
function suggestedFolderOf(parts: readonly string[]) {
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
  const m = new Map<string, T[]>()
  for (const f of files) {
    const dir = f.path.slice(0, f.path.lastIndexOf('/') + 1)
    m.set(dir, [...(m.get(dir) ?? []), f])
  }
  return [...m.entries()]
}

/** Top-level folders a PR touches, two levels deep for monorepo-style roots (apps/, packages/, services/…). */
export function suggestFolders(paths: string[]) {
  const out = new Set<string>()
  for (const parts of paths.map((p) => p.split('/'))) {
    const folder = suggestedFolderOf(parts)
    if (folder) {
      out.add(folder)
    }
  }
  return [...out]
}

/** Files start collapsed when already viewed at this version, marked skippable by Claude, or generated. */
export function initialCollapsed(pr: PullDetail, local: PullLocalState): Record<string, boolean> {
  const ignore = new Set(local.briefing?.briefing.ignore.map((i) => i.path))
  return Object.fromEntries(
    pr.files.map((f) => [f.path, local.viewed[f.path] === f.sha || ignore.has(f.path) || isGenerated(f.path)]),
  )
}

/** New-side line numbers present in each file's diff: where a RIGHT-side comment can attach. */
export function newSideLinesByPath(pr: PullDetail | null): Map<string, Set<number>> {
  const lines = new Map<string, Set<number>>()
  for (const f of pr?.files ?? []) {
    const set = new Set<number>()
    if (f.patch) {
      for (const r of parsePatch(f.patch)) {
        if (r.kind !== 'hunk' && r.newNo !== null) {
          set.add(r.newNo)
        }
      }
    }
    lines.set(f.path, set)
  }
  return lines
}

/** A file's path, with where it came from when it was renamed. */
export function renameTitle(file: { path: string; previousPath?: string | undefined }) {
  if (!file.previousPath) {
    return file.path
  }
  return `${file.previousPath} → ${file.path}`
}
