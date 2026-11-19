import type { Octokit } from '@octokit/rest'
import { pickInstaller, type ReleaseSource } from './release.util.ts'

const VERSION_PREFIX = /^v/iu
const HTTP_NOT_FOUND = 404

export interface LatestRelease {
  version: string
  releaseUrl: string
  downloadUrl: string | null
  notes: string
}

/** The newest published release. Private repositories need a token that can read them. */
export async function fetchLatestRelease(
  octokit: Octokit,
  source: ReleaseSource,
  arch: string,
): Promise<LatestRelease | null> {
  try {
    const { data } = await octokit.repos.getLatestRelease({ owner: source.owner, repo: source.repo })
    return {
      version: data.tag_name.replace(VERSION_PREFIX, ''),
      releaseUrl: data.html_url,
      downloadUrl: pickInstaller(data.assets, arch)?.browser_download_url ?? null,
      notes: data.body ?? '',
    }
  } catch (err) {
    // 404 means no release yet, or a token that cannot see the repository.
    if ((err as { status?: number }).status === HTTP_NOT_FOUND) {
      return null
    }
    throw err
  }
}
