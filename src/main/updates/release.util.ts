/** Where releases are published, from package.json's electron-builder `build.publish` (GitHub only). */
export interface ReleaseSource {
  owner: string
  repo: string
}

export function releaseSourceOf(packageJson: unknown): ReleaseSource | null {
  const publish = (packageJson as { build?: { publish?: unknown } })?.build?.publish
  const entries = Array.isArray(publish) ? publish : publish ? [publish] : []
  const github = entries.find((p): p is { provider: string; owner: string; repo: string } => !!p && typeof p === 'object' && (p as { provider?: string }).provider === 'github')
  return github?.owner && github.repo ? { owner: github.owner, repo: github.repo } : null
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
