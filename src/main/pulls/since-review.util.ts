import type { PullFile, SinceReview } from '@shared/pull.types.ts'

/** A file of GitHub's comparison of two commits, as much of it as is used. */
export interface ComparedFile {
  filename: string
  previous_filename?: string | undefined
  status: string
  additions: number
  deletions: number
  patch?: string | undefined
}

/** GitHub's comparison of the reviewed commit with the head. */
export interface Comparison {
  /** "ahead" when the head only added commits; "diverged" after a rebase or force-push. */
  status: string
  /** How many parents each new commit has: two for a merge. */
  commitParents: number[]
  files: ComparedFile[]
}

/**
 * The PR's files that changed between your review and the head, with that diff. Only the PR's own files are kept,
 * so files changed on the base and brought in by a rebase or merge stay out; each keeps the PR file's sha, so
 * marking it viewed here is the same as in the full diff.
 */
export function buildSinceReview(
  prFiles: readonly PullFile[],
  comparison: Comparison,
  reviewed: { sha: string; at: string },
): SinceReview {
  const byPath = new Map(prFiles.map((file) => [file.path, file]))
  const files = comparison.files.flatMap((compared): PullFile[] => {
    const prFile = byPath.get(compared.filename)
    if (!prFile) {
      return []
    }
    return [
      {
        path: compared.filename,
        sha: prFile.sha,
        previousPath: compared.previous_filename,
        status: compared.status,
        additions: compared.additions,
        deletions: compared.deletions,
        patch: compared.patch,
      },
    ]
  })
  return {
    reviewedSha: reviewed.sha,
    reviewedAt: reviewed.at,
    rebased: comparison.status === 'diverged' || comparison.commitParents.some((parents) => parents > 1),
    files,
  }
}

/** What a file's diff changes, without line numbers or context: its added and removed lines, in order. */
function readChangedLines(patch: string | undefined) {
  return (patch ?? '')
    .split('\n')
    .filter(
      (line) => (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---'),
    )
    .join('\n')
}

/**
 * After a rebase, the files whose own changes differ from what you reviewed: the PR's diff of each file then (from
 * where the branch left its base to the reviewed commit) against now. Files whose changes only moved, because the
 * base moved under them, are left out.
 */
export function keepChangedSinceRebase(
  since: SinceReview,
  prFiles: readonly PullFile[],
  reviewedFiles: readonly ComparedFile[],
): SinceReview {
  const then = new Map(reviewedFiles.map((file) => [file.filename, readChangedLines(file.patch)]))
  const now = new Map(prFiles.map((file) => [file.path, readChangedLines(file.patch)]))
  return { ...since, files: since.files.filter((file) => then.get(file.path) !== now.get(file.path)) }
}
