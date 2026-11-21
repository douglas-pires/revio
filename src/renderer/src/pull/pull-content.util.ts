import type { PullDetail } from '@shared/pull.types.ts'

/**
 * Whether two copies of a PR show the same thing, ignoring when they were fetched. Keeping the old object when
 * nothing changed spares every open diff a re-render after the background refresh.
 */
export function hasSameContent(current: PullDetail | null, next: PullDetail): boolean {
  if (!current) {
    return false
  }
  if (current === next) {
    return true
  }
  return JSON.stringify({ ...current, fetchedAt: '' }) === JSON.stringify({ ...next, fetchedAt: '' })
}
