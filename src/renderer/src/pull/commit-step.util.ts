import type { CommitFile, PullCommit } from '@shared/history.types.ts'
import type { PullFile } from '@shared/pull.types.ts'

/** The commit picked, by position (0 = oldest), or null for all of them; stepping stays within the list. */
export function stepCommit(current: number | null, step: 1 | -1, count: number): number | null {
  if (count === 0) {
    return null
  }
  if (current === null) {
    if (step === 1) {
      return 0
    }
    return count - 1
  }
  const next = current + step
  if (next < 0 || next >= count) {
    return null
  }
  return next
}

/**
 * A commit's files as the Files tab lists them. A file the PR also changes keeps the PR file's sha, so marking it
 * viewed here is the same as in the full diff; one the PR no longer changes gets the commit's sha. A merge keeps only
 * the PR's own files: the rest came in from the branch merged.
 */
export function toCommitPullFiles(files: readonly CommitFile[], prFiles: readonly PullFile[], commit: PullCommit) {
  const shas = new Map(prFiles.map((file) => [file.path, file.sha]))
  const kept = files.filter((file) => !commit.isMerge || shas.has(file.path))
  return kept.map(
    (file): PullFile => ({
      path: file.path,
      sha: shas.get(file.path) ?? commit.sha,
      previousPath: file.previousPath,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    }),
  )
}
