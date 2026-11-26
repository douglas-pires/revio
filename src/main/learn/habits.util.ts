import { CHECKED_KINDS, type CommentKind } from '@shared/comment-kinds.util.ts'
import type { ReviewHabits } from '@shared/learn.types.ts'
import type { PastReview } from '@shared/review-history.types.ts'

const TOP_FOLDERS = 5
/** Below this many sorted comments, a kind you never commented on says little. */
const MIN_SORTED_TO_JUDGE = 30
/** A kind under this share of your sorted comments counts as seldom checked. */
const RARE_SHARE = 0.03
const LAST_SEGMENT = /\/?[^/]*$/u

const keyOf = (review: PastReview) => `${review.repo}#${review.number}`

/** Approved PRs, and those where none of your reviews had a line comment. */
function countApprovals(reviews: readonly PastReview[]) {
  const commented = new Set(reviews.filter((review) => review.comments.length > 0).map(keyOf))
  const approved = new Set(reviews.filter((review) => review.state === 'APPROVED').map(keyOf))
  return { approvals: approved.size, silentApprovals: [...approved].filter((key) => !commented.has(key)).length }
}

function rankFolders(reviews: readonly PastReview[]) {
  const counts = new Map<string, number>()
  for (const review of reviews) {
    for (const comment of review.comments) {
      const folder = `${review.repo}/${comment.path.replace(LAST_SEGMENT, '')}`
      counts.set(folder, (counts.get(folder) ?? 0) + 1)
    }
  }
  return [...counts]
    .map(([folder, count]) => ({ folder, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, TOP_FOLDERS)
}

function countKinds(urls: readonly string[], kinds: Readonly<Record<string, CommentKind[]>>) {
  const counts = new Map<CommentKind, number>()
  let sorted = 0
  for (const url of urls) {
    const found = kinds[url]
    if (found) {
      sorted += 1
      for (const kind of found) {
        counts.set(kind, (counts.get(kind) ?? 0) + 1)
      }
    }
  }
  return { counts, sorted }
}

/** Your review habits from your past reviews and what Claude sorted your comments into so far. */
export function summarizeHabits(
  reviews: readonly PastReview[],
  kinds: Readonly<Record<string, CommentKind[]>>,
): ReviewHabits {
  const urls = reviews.flatMap((review) => review.comments.map((comment) => comment.url))
  const { counts, sorted } = countKinds(urls, kinds)
  let rarelyChecked: CommentKind[] = []
  if (sorted >= MIN_SORTED_TO_JUDGE) {
    rarelyChecked = CHECKED_KINDS.filter((kind) => (counts.get(kind) ?? 0) / sorted < RARE_SHARE)
  }
  return {
    reviews: reviews.length,
    pulls: new Set(reviews.map(keyOf)).size,
    comments: urls.length,
    ...countApprovals(reviews),
    topFolders: rankFolders(reviews),
    kinds: [...counts].map(([kind, count]) => ({ kind, count })).sort((left, right) => right.count - left.count),
    sorted,
    rarelyChecked,
  }
}
