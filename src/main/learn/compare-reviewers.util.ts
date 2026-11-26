import type { RaisedPoint, SharedReview } from '@shared/learn.types.ts'

/** Two points within this many lines of each other on the same file are the same catch. */
const NEARBY_LINES = 5
const BOT = /\[bot\]$|^(?:github-actions|dependabot|renovate|coderabbitai|copilot)/iu

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

/** One PR seen from your side, or null when nobody else reviewed it. */
function compareOne(viewer: string, pull: PullPoints): SharedReview | null {
  const reviewerPoints = pull.points.filter((point) => point.author !== pull.author && !BOT.test(point.author))
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

/** The PRs others reviewed with you, newest first as given: their points you did not raise, and the overlap. */
export function compareReviewers(viewer: string, pulls: readonly PullPoints[]): SharedReview[] {
  return pulls.map((pull) => compareOne(viewer, pull)).filter((review): review is SharedReview => review !== null)
}
