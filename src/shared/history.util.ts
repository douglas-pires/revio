import type { BlameRange, CommitFile, CommitSummary, FileHistoryEntry } from './history.types'

/** The blame range covering `line`, or undefined. Ranges must be sorted by start, as GitHub returns them. */
export function blameAt(ranges: readonly BlameRange[], line: number): BlameRange | undefined {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const r = ranges[mid]!
    if (line < r.start) hi = mid - 1
    else if (line > r.end) lo = mid + 1
    else return r
  }
  return undefined
}

/** Flags the commits that belong to the PR. */
export function markPrCommits(commits: readonly CommitSummary[], prShas: ReadonlySet<string>): FileHistoryEntry[] {
  return commits.map((c) => ({ ...c, inThisPr: prShas.has(c.sha) }))
}

/** The commit's diff for `path`, matching renames by their old name too; null when it has none. */
export function patchOfFile(files: readonly CommitFile[], path: string): string | null {
  return files.find((f) => f.path === path || f.previousPath === path)?.patch ?? null
}
