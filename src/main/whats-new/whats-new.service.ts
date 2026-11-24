import type { Octokit } from '@octokit/rest'
import type { ReleaseNotes } from '@shared/whats-new.types.ts'
import type { ReleaseSource } from '../updates/release.util.ts'
import { parseReleaseNotes } from './release-notes.util.ts'

/** Releases shown; pre-releases share the page GitHub answers with, so more are asked for. */
const RELEASE_LIMIT = 20
const PAGE_SIZE = 100
const VERSION_PREFIX = /^v/iu

/** The notes of the latest releases, newest first, without pre-releases. */
export async function fetchReleaseNotes(octokit: Octokit, source: ReleaseSource): Promise<ReleaseNotes[]> {
  const { data } = await octokit.repos.listReleases({ owner: source.owner, repo: source.repo, per_page: PAGE_SIZE })
  return data
    .filter((release) => !(release.prerelease || release.draft))
    .slice(0, RELEASE_LIMIT)
    .map((release) =>
      parseReleaseNotes(
        {
          version: release.tag_name.replace(VERSION_PREFIX, ''),
          publishedAt: release.published_at ?? release.created_at,
          url: release.html_url,
        },
        release.body ?? '',
      ),
    )
}
