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
  const entries = Array.isArray(publish) ? publish : publish ? [publish] : []
  const github = entries.find((p): p is { provider: string; owner: string; repo: string } => !!p && typeof p === 'object' && (p as { provider?: string }).provider === 'github')
  if (github?.owner && github.repo) return { owner: github.owner, repo: github.repo }
  return githubRepoOf(pkg?.repository)
}

/** owner/repo from a package.json `repository` (a URL string or { url }), when it is on GitHub. */
function githubRepoOf(repository: unknown): ReleaseSource | null {
  const url = typeof repository === 'string' ? repository : (repository as { url?: unknown } | null)?.url
  if (typeof url !== 'string') return null
  const m = /^(?:github:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url) ?? /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url)
  return m ? { owner: m[1]!, repo: m[2]! } : null
}

const parts = (v: string) =>
  v
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]!
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)

/** True when `candidate` is a higher version than `current` (numeric major.minor.patch; "v" and pre-release tags ignored). */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parts(candidate)
  const b = parts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d) return d > 0
  }
  return false
}

/** The release asset to install on this Mac: the dmg for its architecture, else any dmg. */
export function pickInstaller<T extends { name: string }>(assets: readonly T[], arch: string): T | undefined {
  const dmgs = assets.filter((a) => a.name.endsWith('.dmg'))
  return dmgs.find((a) => a.name.includes(arch)) ?? dmgs[0]
}
