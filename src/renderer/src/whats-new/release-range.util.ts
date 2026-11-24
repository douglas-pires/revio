import type { ReleaseNotes } from '@shared/whats-new.types.ts'

/** The running release and those before it; all of them when it is not among them (a build from source). */
export function dropLaterReleases(releases: readonly ReleaseNotes[], current: string): ReleaseNotes[] {
  return releases.slice(Math.max(0, findRelease(releases, current)))
}

/** The releases new to someone who last used `previous`: those after it, or just the latest when it is not known. */
export function listNewVersions(releases: readonly ReleaseNotes[], previous: string | null): Set<string> {
  if (previous === null) {
    return new Set(releases.slice(0, 1).map(({ version }) => version))
  }
  const previousIndex = findRelease(releases, previous)
  let newReleases = releases
  if (previousIndex >= 0) {
    newReleases = releases.slice(0, previousIndex)
  }
  return new Set(newReleases.map(({ version }) => version))
}

function findRelease(releases: readonly ReleaseNotes[], version: string) {
  return releases.findIndex((release) => release.version === version)
}
