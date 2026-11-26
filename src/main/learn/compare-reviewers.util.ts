import type { RaisedPoint, SharedReview } from '@shared/learn.types.ts'

/** Two points within this many lines of each other on the same file are the same catch. */
const NEARBY_LINES = 5
/** Bots and AI reviewers GitHub lists as users; apps (`[bot]`, or a Bot account) are known from GitHub's own label. */
const BOT_NAMES =
  /\[bot\]$|^(?:github-actions|dependabot|renovate|coderabbit|copilot|chatgpt|codex|claude|cursor|gemini|sourcery|semgrep|sonar|snyk|deepsource|codacy|codeant|greptile|ellipsis|qodo)/iu

/** A PR with everyone's review points on it. */
export interface PullPoints {
  repo: string
  number: number
  title: string
  url: string
  author: string
  points: RaisedPoint[]
}

/** Whether two points are about the same code: one file, and lines close together (or both on the whole file). */
function sameSpot(left: RaisedPoint, right: RaisedPoint) {
  if (left.path !== right.path) {
    return false
  }
  if (left.line === null || right.line === null) {
    return left.line === right.line
  }
  return Math.abs(left.line - right.line) <= NEARBY_LINES
}

/** Whether a point came from a bot or an AI reviewer: GitHub says so, or the name is a known one. */
const isFromBot = (point: { author: string; fromBot: boolean }) => point.fromBot || BOT_NAMES.test(point.author)

/** One PR seen from your side, or null when nobody else reviewed it. */
function compareOne(viewer: string, pull: PullPoints, includeBots: boolean): SharedReview | null {
  const reviewerPoints = pull.points.filter(
    (point) => point.author !== pull.author && (includeBots || !isFromBot(point)),
  )
  const mine = reviewerPoints.filter((point) => point.author === viewer)
  const theirs = reviewerPoints.filter((point) => point.author !== viewer)
  if (theirs.length === 0) {
    return null
  }
  const both = mine.filter((point) => theirs.some((other) => sameSpot(point, other))).length
  const { author: _author, points: _points, ...rest } = pull
  return {
    ...rest,
    reviewers: [...new Set(theirs.map((point) => point.author))],
    theyRaised: theirs.filter((point) => !mine.some((own) => sameSpot(point, own))),
    onlyYou: mine.length - both,
    both,
  }
}

/**
 * The PRs others reviewed with you, newest first as given: their points you did not raise, and the overlap. Bots and
 * AI reviewers count only when `includeBots`; the PR's author never does.
 */
export function compareReviewers(viewer: string, pulls: readonly PullPoints[], includeBots = false): SharedReview[] {
  return pulls
    .map((pull) => compareOne(viewer, pull, includeBots))
    .filter((review): review is SharedReview => review !== null)
}
