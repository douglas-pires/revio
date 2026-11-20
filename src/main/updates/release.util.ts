/** `owner/repo` or `github:owner/repo`, as npm allows in `repository`. */
const SHORT_REPO = /^(?:github:)?(?<owner>[\w.-]+)\/(?<repo>[\w.-]+?)(?:\.git)?$/u
const GITHUB_URL = /github\.com[:/](?<owner>[\w.-]+)\/(?<repo>[\w.-]+?)(?:\.git)?\/?$/u
const VERSION_PREFIX = /^v/iu

/** owner/repo from a package.json `repository` (a URL string or { url }), when it is on GitHub. */
function githubRepoOf(repository: unknown): ReleaseSource | null {
  const url = repositoryUrlOf(repository)
  if (url === undefined) {
    return null
  }
  const groups = (SHORT_REPO.exec(url) ?? GITHUB_URL.exec(url))?.groups
  if (!(groups?.owner && groups.repo)) {
    return null
  }
  return { owner: groups.owner, repo: groups.repo }
}

/** A package.json `repository`'s URL: the field itself when it is a string, else its `url`. */
function repositoryUrlOf(repository: unknown): string | undefined {
  if (typeof repository === 'string') {
    return repository
  }
  const { url } = (repository ?? {}) as { url?: unknown }
  if (typeof url === 'string') {
    return url
  }
  return undefined
}

/** A package.json `build.publish`, which may be one entry or a list. */
function publishEntriesOf(publish: unknown): unknown[] {
  if (Array.isArray(publish)) {
    return publish
  }
  if (publish) {
    return [publish]
  }
  return []
}

const parts = (v: string) =>
  v
    .trim()
    .replace(VERSION_PREFIX, '')
    .split('-')[0]
    ?.split('.')
    .map((n) => Number.parseInt(n, 10) || 0) ?? []

/** A pre-release version, like a build of `main` (0.2.0-dev.43). */
const isPreRelease = (v: string) => v.trim().includes('-')

/** Where releases are published (GitHub only). */
export interface ReleaseSource {
  owner: string
  repo: string
}

/**
 * The release source in package.json: electron-builder's GitHub `build.publish` target, else the GitHub `repository`.
 * The fallback matters: electron-builder drops `build` from the package.json it packs into the app, so an installed
 * Revio only has `repository` to go by.
 */
export function releaseSourceOf(packageJson: unknown): ReleaseSource | null {
  const pkg = packageJson as { build?: { publish?: unknown }; repository?: unknown } | null
  const publish = pkg?.build?.publish
  const entries = publishEntriesOf(publish)
  const github = entries.find(
    (p): p is { provider: string; owner: string; repo: string } =>
      Boolean(p) && typeof p === 'object' && (p as { provider?: string }).provider === 'github',
  )
  if (github?.owner && github.repo) {
    return { owner: github.owner, repo: github.repo }
  }
  return githubRepoOf(pkg?.repository)
}

/**
 * True when `candidate` is a higher version than `current`: numeric major.minor.patch, then, for the same numbers, a
 * release is newer than a pre-release of it (0.2.0 is newer than 0.2.0-dev.43), as in semver. "v" is ignored.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parts(candidate)
  const b = parts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d) {
      return d > 0
    }
  }
  return isPreRelease(current) && !isPreRelease(candidate)
}

/** The release asset to install on this Mac: the dmg for its architecture, else any dmg. */
export function pickInstaller<T extends { name: string }>(assets: readonly T[], arch: string): T | undefined {
  const dmgs = assets.filter((a) => a.name.endsWith('.dmg'))
  return dmgs.find((a) => a.name.includes(arch)) ?? dmgs[0]
}
