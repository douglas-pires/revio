import type { Octokit } from '@octokit/rest'
import type { BlameRange, CommitSummary, FileAtCommit, FileHistoryEntry } from '@shared/history.types'
import { markPrCommits } from '@shared/history.util'
import type { PullRef } from '@shared/pull.types'
import { smallAvatar } from '../github/github.client'
import { splitRepo } from '../github/repo-name.util'

const HISTORY_LIMIT = 30

type RawBlameCommit = {
  oid: string
  abbreviatedOid: string
  messageHeadline: string
  committedDate: string
  url: string
  author: { name: string | null; user: { login: string; avatarUrl: string } | null } | null
}

/** Who last changed each line of the file at `sha` (GitLens-style blame). */
export async function fetchBlame(octokit: Octokit, at: FileAtCommit): Promise<BlameRange[]> {
  const { owner, repo } = splitRepo(at.repo)
  type Data = { repository: { object: { blame: { ranges: { startingLine: number; endingLine: number; commit: RawBlameCommit }[] } } | null } }
  const data = await octokit.graphql<Data>(
    `query ($owner: String!, $repo: String!, $sha: GitObjectID!, $path: String!) {
      repository(owner: $owner, name: $repo) { object(oid: $sha) { ... on Commit { blame(path: $path) { ranges {
        startingLine endingLine
        commit { oid abbreviatedOid messageHeadline committedDate url author { name user { login avatarUrl(size: 64) } } }
      } } } } }
    }`,
    { owner, repo, sha: at.sha, path: at.path },
  )
  return (data.repository.object?.blame.ranges ?? []).map((r) => ({ start: r.startingLine, end: r.endingLine, commit: fromGraphql(r.commit) }))
}

function fromGraphql(c: RawBlameCommit): CommitSummary {
  return {
    sha: c.oid,
    shortSha: c.abbreviatedOid,
    headline: c.messageHeadline,
    author: c.author?.user?.login ?? c.author?.name ?? 'unknown',
    authorAvatar: c.author?.user?.avatarUrl ?? '',
    date: c.committedDate,
    url: c.url,
  }
}

/** The latest commits that changed the file up to `at.sha`, flagging this PR's own. */
export async function fetchFileHistory(octokit: Octokit, pull: PullRef, at: FileAtCommit): Promise<FileHistoryEntry[]> {
  const { owner, repo } = splitRepo(at.repo)
  const [commits, prCommits] = await Promise.all([
    octokit.repos.listCommits({ owner, repo, sha: at.sha, path: at.path, per_page: HISTORY_LIMIT }),
    octokit.paginate(octokit.pulls.listCommits, { owner, repo, pull_number: pull.number, per_page: 100 }),
  ])
  return markPrCommits(
    commits.data.map((c) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      headline: c.commit.message.split('\n')[0] ?? '',
      author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
      authorAvatar: smallAvatar(c.author?.avatar_url),
      date: c.commit.author?.date ?? c.commit.committer?.date ?? '',
      url: c.html_url,
    })),
    new Set(prCommits.map((c) => c.sha)),
  )
}

/** What the commit changed in the file, as a unified diff; null when GitHub has no patch (binary or too large). */
export async function fetchCommitFilePatch(octokit: Octokit, at: FileAtCommit): Promise<string | null> {
  const { owner, repo } = splitRepo(at.repo)
  const { data } = await octokit.repos.getCommit({ owner, repo, ref: at.sha, per_page: 300 })
  return data.files?.find((f) => f.filename === at.path || f.previous_filename === at.path)?.patch ?? null
}
