import type { PullDetail } from '@shared/pull.types.ts'

/**
 * Whether two copies of a PR show the same thing, ignoring when they were fetched. Keeping the old object when
 * nothing changed spares every open diff a re-render after the background refresh.
 */
export function hasSameContent(a: PullDetail | null, b: PullDetail): boolean {
  if (!a) {
    return false
  }
  if (a === b) {
    return true
  }
  return JSON.stringify({ ...a, fetchedAt: '' }) === JSON.stringify({ ...b, fetchedAt: '' })
}
