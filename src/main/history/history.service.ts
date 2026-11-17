import type { Octokit } from '@octokit/rest'
import type { BlameRange, CommitFile, CommitRef, CommitSummary, FileAtCommit, FileHistoryEntry, PullCommit } from '@shared/history.types'
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
  return markPrCommits(commits.data.map(fromRest), new Set(prCommits.map((c) => c.sha)))
}

/** The files a commit changed, with their diffs (GitHub lists up to 300). */
export async function fetchCommitFiles(octokit: Octokit, at: CommitRef): Promise<CommitFile[]> {
  const { owner, repo } = splitRepo(at.repo)
  const { data } = await octokit.repos.getCommit({ owner, repo, ref: at.sha, per_page: 300 })
  return (data.files ?? []).map((f) => ({
    path: f.filename,
    previousPath: f.previous_filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }))
}

/** The PR's commits, oldest first, as GitHub lists them (up to 250). */
export async function fetchPullCommits(octokit: Octokit, pull: PullRef): Promise<PullCommit[]> {
  const { owner, repo } = splitRepo(pull.repo)
  const commits = await octokit.paginate(octokit.pulls.listCommits, { owner, repo, pull_number: pull.number, per_page: 100 })
  return commits.map((c) => ({ ...fromRest(c), message: c.commit.message }))
}

type RestCommit = Awaited<ReturnType<Octokit['repos']['listCommits']>>['data'][number]

function fromRest(c: RestCommit): CommitSummary {
  return {
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    headline: c.commit.message.split('\n')[0] ?? '',
    author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
    authorAvatar: smallAvatar(c.author?.avatar_url),
    date: c.commit.author?.date ?? c.commit.committer?.date ?? '',
    url: c.html_url,
  }
}
