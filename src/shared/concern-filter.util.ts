import type { Concern, DismissedConcern } from './claude.types.ts'

/** Two concerns this many lines apart, in one file, are about the same code. */
const NEARBY_LINES = 3
const NON_WORDS = /[^\p{L}\p{N}]+/gu

const CONFIDENCE_ORDER: Record<NonNullable<Concern['confidence']>, number> = { high: 0, medium: 1, low: 2 }

const normalize = (title: string) => title.toLowerCase().replaceAll(NON_WORDS, ' ').trim()

/** Whether a concern is one you dismissed: the same file, and the same title or code close by. */
function matchesDismissed(concern: Concern, dismissed: DismissedConcern) {
  if (concern.path !== dismissed.path) {
    return false
  }
  if (normalize(concern.title) === normalize(dismissed.title)) {
    return true
  }
  return concern.line !== null && dismissed.line !== null && Math.abs(concern.line - dismissed.line) <= NEARBY_LINES
}

/** The concerns you have not dismissed, the surest first (those without a confidence count as medium). */
export function keepUndismissed(concerns: readonly Concern[], dismissed: readonly DismissedConcern[]): Concern[] {
  return concerns
    .filter((concern) => !dismissed.some((entry) => matchesDismissed(concern, entry)))
    .toSorted(
      (left, right) => CONFIDENCE_ORDER[left.confidence ?? 'medium'] - CONFIDENCE_ORDER[right.confidence ?? 'medium'],
    )
}
