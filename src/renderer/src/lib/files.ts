import type { PullDetail, PullLocalState } from '@shared/types'
import { parsePatch } from './diff'
import { isGenerated } from './format'

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
  for (const p of paths) {
    const parts = p.split('/')
    if (parts.length < 2) continue
    const deep = ['apps', 'packages', 'services', 'libs', 'modules'].includes(parts[0]!) && parts.length > 2
    out.add(deep ? `${parts[0]}/${parts[1]}/` : `${parts[0]}/`)
  }
  return [...out]
}

/** Files start collapsed when already viewed at this version, marked skippable by Claude, or generated. */
export function initialCollapsed(pr: PullDetail, local: PullLocalState): Record<string, boolean> {
  const ignore = new Set(local.briefing?.briefing.ignore.map((i) => i.path))
  return Object.fromEntries(pr.files.map((f) => [f.path, local.viewed[f.path] === f.sha || ignore.has(f.path) || isGenerated(f.path)]))
}

/** New-side line numbers present in each file's diff: where a RIGHT-side comment can attach. */
export function newSideLinesByPath(pr: PullDetail | null): Map<string, Set<number>> {
  const lines = new Map<string, Set<number>>()
  for (const f of pr?.files ?? []) {
    const set = new Set<number>()
    if (f.patch) for (const r of parsePatch(f.patch)) if (r.kind !== 'hunk' && r.newNo != null) set.add(r.newNo)
    lines.set(f.path, set)
  }
  return lines
}
