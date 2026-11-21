import type { BlameRange, CommitFile, CommitSummary, FileHistoryEntry } from './history.types.ts'

/** The blame range covering `line`, or undefined. Ranges must be sorted by start, as GitHub returns them. */
export function blameAt(ranges: readonly BlameRange[], line: number): BlameRange | undefined {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const range = ranges[mid]
    if (!range) {
      return undefined
    }
    if (line < range.start) {
      hi = mid - 1
    } else if (line > range.end) {
      lo = mid + 1
    } else {
      return range
    }
  }
  return undefined
}

/** Flags the commits that belong to the PR. */
export function markPrCommits(commits: readonly CommitSummary[], prShas: ReadonlySet<string>): FileHistoryEntry[] {
  return commits.map((commit) => ({ ...commit, inThisPr: prShas.has(commit.sha) }))
}

/** The commit's diff for `path`, matching renames by their old name too; null when it has none. */
export function patchOfFile(files: readonly CommitFile[], path: string): string | null {
  return files.find((file) => file.path === path || file.previousPath === path)?.patch ?? null
}
