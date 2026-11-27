import type { PastReview } from '@shared/review-history.types.ts'

const LAST_SEGMENT = /\/?[^/]*$/u

/** The folder a path is in: "apps/web/src" for "apps/web/src/app.ts", '' at the top. */
const readFolder = (path: string) => path.replace(LAST_SEGMENT, '')

/**
 * Files of a PR in code you have not reviewed before: no comment of yours in their folder or the folder above it.
 * None when you never commented in the repository, since then everything would be new and the mark says nothing.
 */
export function findUnfamiliarFiles(repo: string, paths: readonly string[], reviews: readonly PastReview[]): string[] {
  const repoName = repo.toLowerCase()
  const known = new Set(
    reviews
      .filter((review) => review.repo.toLowerCase() === repoName)
      .flatMap((review) => review.comments.map((comment) => readFolder(comment.path))),
  )
  if (known.size === 0) {
    return []
  }
  return paths.filter((path) => {
    const folder = readFolder(path)
    return !(known.has(folder) || known.has(readFolder(folder)))
  })
}
