import type { Octokit } from '@octokit/rest'
import type { PullDetail, SinceReview } from '@shared/pull.types.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { buildSinceReview, keepChangedSinceRebase } from './since-review.util.ts'

const NOT_FOUND = 404

/**
 * What changed in the PR since your last review, or null when you have not reviewed it. Fails with a sentence when
 * the commit you reviewed is gone from GitHub (a force-push can remove it).
 */
export async function fetchSinceReview(octokit: Octokit, pr: PullDetail): Promise<SinceReview | null> {
  const { lastReviewedSha: sha, lastReviewedAt: at } = pr
  if (!(sha && at)) {
    return null
  }
  const reviewed = { sha, at }
  if (sha === pr.headSha) {
    return buildSinceReview(pr.files, { status: 'identical', commitParents: [], files: [] }, reviewed)
  }
  const { owner, repo } = splitRepo(pr.repo)
  try {
    const { data } = await octokit.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${sha}...${pr.headSha}` })
    const since = buildSinceReview(
      pr.files,
      {
        status: data.status,
        commitParents: data.commits.map((commit) => commit.parents.length),
        files: data.files ?? [],
      },
      reviewed,
    )
    if (!since.rebased) {
      return since
    }
    // The PR's own diff as you reviewed it: from where the reviewed commit left the base, to that commit.
    const then = await octokit.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${pr.baseRef}...${sha}` })
    return keepChangedSinceRebase(since, pr.files, then.data.files ?? [])
  } catch (failure) {
    if (failure instanceof Error && 'status' in failure && failure.status === NOT_FOUND) {
      throw new Error(
        'The commit you reviewed is no longer on GitHub (the branch was force-pushed), so the changes since can’t be shown.',
        { cause: failure },
      )
    }
    throw failure
  }
}
