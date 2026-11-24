import type { UnseenUpdate } from '@shared/whats-new.types.ts'
import { isNewerVersion } from '../updates/release.util.ts'

const RELEASE_VERSION = /^\d+\.\d+\.\d+$/u
/** What a build not made by the release workflow calls itself. */
const UNRELEASED = '0.0.0'

/** Whether this is a release, not a pre-release or a build made from source. */
export function isRelease(version: string): boolean {
  return RELEASE_VERSION.test(version) && version !== UNRELEASED
}

/**
 * The update to show after it was installed: this is a newer release than the one last seen. Someone new to Revio has
 * nothing to catch up on; someone who used it before this was kept track of (`seen` null) has.
 */
export function findUnseenUpdate(state: {
  current: string
  seen: string | null
  usedBefore: boolean
}): UnseenUpdate | null {
  const { current, seen } = state
  if (!isRelease(current)) {
    return null
  }
  if (seen === null) {
    if (state.usedBefore) {
      return { previous: null }
    }
    return null
  }
  if (isNewerVersion(current, seen)) {
    return { previous: seen }
  }
  return null
}
