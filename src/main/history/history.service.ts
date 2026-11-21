import type { Octokit } from '@octokit/rest'
import type {
  BlameRange,
  CommitFile,
  CommitRef,
  CommitSummary,
  FileAtCommit,
  FileHistoryEntry,
  PullCommit,
} from '@shared/history.types.ts'
import { markPrCommits } from '@shared/history.util.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { smallAvatar } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'

/** How many characters of a commit sha GitHub shows. */
const SHORT_SHA_LENGTH = 7

const HISTORY_LIMIT = 30

interface RawBlameCommit {
  oid: string
  abbreviatedOid: string
  messageHeadline: string
  committedDate: string
  url: string
  author: { name: string | null; user: { login: string; avatarUrl: string } | null } | null
}

function fromGraphql(commit: RawBlameCommit): CommitSummary {
  return {
    sha: commit.oid,
    shortSha: commit.abbreviatedOid,
    headline: commit.messageHeadline,
    author: commit.author?.user?.login ?? commit.author?.name ?? 'unknown',
    authorAvatar: commit.author?.user?.avatarUrl ?? '',
    date: commit.committedDate,
    url: commit.url,
  }
}

type RestCommit = Awaited<ReturnType<Octokit['repos']['listCommits']>>['data'][number]

function fromRest(commit: RestCommit): CommitSummary {
  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, SHORT_SHA_LENGTH),
    headline: commit.commit.message.split('\n')[0] ?? '',
    author: commit.author?.login ?? commit.commit.author?.name ?? 'unknown',
    authorAvatar: smallAvatar(commit.author?.avatar_url),
    date: commit.commit.author?.date ?? commit.commit.committer?.date ?? '',
    url: commit.html_url,
  }
}

/** Who last changed each line of the file at `sha` (GitLens-style blame). */
export async function fetchBlame(octokit: Octokit, at: FileAtCommit): Promise<BlameRange[]> {
  const { owner, repo } = splitRepo(at.repo)
  interface Data {
    repository: {
      object: { blame: { ranges: { startingLine: number; endingLine: number; commit: RawBlameCommit }[] } } | null
    }
  }
  const data = await octokit.graphql<Data>(
    `query ($owner: String!, $repo: String!, $sha: GitObjectID!, $path: String!) {
      repository(owner: $owner, name: $repo) { object(oid: $sha) { ... on Commit { blame(path: $path) { ranges {
        startingLine endingLine
        commit { oid abbreviatedOid messageHeadline committedDate url author { name user { login avatarUrl(size: 64) } } }
      } } } } }
    }`,
    { owner, repo, sha: at.sha, path: at.path },
  )
  return (data.repository.object?.blame.ranges ?? []).map((range) => ({
    start: range.startingLine,
    end: range.endingLine,
    commit: fromGraphql(range.commit),
  }))
}

/** The latest commits that changed the file up to `at.sha`, flagging this PR's own. */
export async function fetchFileHistory(octokit: Octokit, pull: PullRef, at: FileAtCommit): Promise<FileHistoryEntry[]> {
  const { owner, repo } = splitRepo(at.repo)
  const [commits, prCommits] = await Promise.all([
    octokit.repos.listCommits({ owner, repo, sha: at.sha, path: at.path, per_page: HISTORY_LIMIT }),
    octokit.paginate(octokit.pulls.listCommits, { owner, repo, pull_number: pull.number, per_page: 100 }),
  ])
  return markPrCommits(commits.data.map(fromRest), new Set(prCommits.map((commit) => commit.sha)))
}

/** The files a commit changed, with their diffs (GitHub lists up to 300). */
export async function fetchCommitFiles(octokit: Octokit, at: CommitRef): Promise<CommitFile[]> {
  const { owner, repo } = splitRepo(at.repo)
  const { data } = await octokit.repos.getCommit({ owner, repo, ref: at.sha, per_page: 300 })
  return (data.files ?? []).map((file) => ({
    path: file.filename,
    previousPath: file.previous_filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch,
  }))
}

/** The PR's commits, oldest first, as GitHub lists them (up to 250). */
export async function fetchPullCommits(octokit: Octokit, pull: PullRef): Promise<PullCommit[]> {
  const { owner, repo } = splitRepo(pull.repo)
  const commits = await octokit.paginate(octokit.pulls.listCommits, {
    owner,
    repo,
    pull_number: pull.number,
    per_page: 100,
  })
  return commits.map((commit) => ({ ...fromRest(commit), message: commit.commit.message }))
}
