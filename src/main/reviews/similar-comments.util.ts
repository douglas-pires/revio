import type { PastReview, SimilarComment } from '@shared/review-history.types.ts'

/** Below this many telling words a comment ("nit", "same here") is too short to call a repeat. */
const MIN_WORDS = 4
/** Telling words two comments must share. */
const MIN_SHARED = 3
/** Share of their telling words two comments must have in common. */
const MIN_OVERLAP = 0.4
/** Words shorter than this carry little meaning. */
const MIN_WORD_LENGTH = 3
const MAX_MATCHES = 5

const CODE_BLOCKS = /```[\s\S]*?```/gu
const INLINE_CODE = /`[^`]*`/gu
const LINKS = /https?:\/\/\S+/gu
const MENTIONS = /@[\w-]+/gu
const WORD_BREAKS = /[^\p{L}\p{N}]+/u

const STOP_WORDS = new Set(
  'the and for are but not you your this that with have has had was were will would could should can just also here there them they then than into from what when where which while about been being does did its it’s isn’t don’t why how use using used make sure maybe please'.split(
    ' ',
  ),
)

/** The words of a comment that say what it is about: no code, links, mentions or filler. */
export function readTellingWords(body: string): Set<string> {
  const prose = body
    .replaceAll(CODE_BLOCKS, ' ')
    .replaceAll(INLINE_CODE, ' ')
    .replaceAll(LINKS, ' ')
    .replaceAll(MENTIONS, ' ')
    .toLowerCase()
  return new Set(prose.split(WORD_BREAKS).filter((word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word)))
}

/** How alike two sets of words are: the shared ones, and their share of all of them (0 to 1). */
function compareWords(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  let shared = 0
  for (const word of left) {
    if (right.has(word)) {
      shared++
    }
  }
  const all = left.size + right.size - shared
  if (all === 0) {
    return { shared, overlap: 0 }
  }
  return { shared, overlap: shared / all }
}

/** Your past comments that read like `body`, most alike first. None for a comment too short to judge. */
export function findSimilarComments(body: string, reviews: readonly PastReview[]): SimilarComment[] {
  const words = readTellingWords(body)
  if (words.size < MIN_WORDS) {
    return []
  }
  const matches: { comment: SimilarComment; overlap: number }[] = []
  for (const review of reviews) {
    for (const comment of review.comments) {
      const { shared, overlap } = compareWords(words, readTellingWords(comment.body))
      if (shared >= MIN_SHARED && overlap >= MIN_OVERLAP) {
        matches.push({ comment: { ...comment, repo: review.repo, number: review.number }, overlap })
      }
    }
  }
  return matches
    .sort(
      (left, right) => right.overlap - left.overlap || right.comment.createdAt.localeCompare(left.comment.createdAt),
    )
    .slice(0, MAX_MATCHES)
    .map((match) => match.comment)
}
