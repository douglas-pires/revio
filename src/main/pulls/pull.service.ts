import type { Octokit } from '@octokit/rest'
import type { DraftComment, PullDetail, PullFile, PullRef, PullThreadStatus, ReviewComment, SubmitReviewInput } from '@shared/pull.types'
import { gh, smallAvatar, viewerLogin } from '../github/github.client'
import { splitRepo } from '../github/repo-name.util'
import { planReview } from './review-plan.util'

/** Which review threads are resolved; REST comments do not say. A failure only hides that status. */
async function fetchThreadStatus(octokit: Octokit, ref: PullRef): Promise<PullThreadStatus[]> {
  const { owner, repo } = splitRepo(ref.repo)
  const { number } = ref
  type Data = { repository: { pullRequest: { reviewThreads: { nodes: ({ id: string; isResolved: boolean; comments: { nodes: ({ databaseId: number } | null)[] } } | null)[] } } | null } }
  try {
    const data = await octokit.graphql<Data>(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
          reviewThreads(first: 100) { nodes { id isResolved comments(first: 1) { nodes { databaseId } } } }
        } }
      }`,
      { owner, repo, number },
    )
    return (data.repository.pullRequest?.reviewThreads.nodes ?? []).flatMap((t) => {
      const rootCommentId = t?.comments.nodes[0]?.databaseId
      return t && rootCommentId ? [{ id: t.id, rootCommentId, resolved: t.isResolved }] : []
    })
  } catch (err) {
    console.error('[revio] thread status lookup failed:', err instanceof Error ? err.message : err)
    return []
  }
}

export async function fetchPull(ref: PullRef): Promise<PullDetail> {
  const { repo: repoFull, number } = ref
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  const [pr, files, comments, reviews, viewer, threads] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number: number }),
    octokit.paginate(octokit.pulls.listFiles, { owner, repo, pull_number: number, per_page: 100 }),
    octokit.paginate(octokit.pulls.listReviewComments, { owner, repo, pull_number: number, per_page: 100 }),
    octokit.paginate(octokit.pulls.listReviews, { owner, repo, pull_number: number, per_page: 100 }),
    viewerLogin(),
    fetchThreadStatus(octokit, ref),
  ])
  const mine = reviews.filter((r) => r.user?.login === viewer && r.state !== 'PENDING')
  const decisive = mine.filter((r) => r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED' || r.state === 'DISMISSED').at(-1)
  const latest = decisive ?? mine.at(-1)
  const p = pr.data
  return {
    fetchedAt: new Date().toISOString(),
    repo: repoFull,
    number,
    title: p.title,
    body: p.body ?? '',
    url: p.html_url,
    author: p.user?.login ?? 'ghost',
    authorAvatar: smallAvatar(p.user?.avatar_url),
    headRef: p.head.ref,
    baseRef: p.base.ref,
    headSha: p.head.sha,
    baseSha: p.base.sha,
    viewer,
    myReview: latest
      ? {
          state: latest.state as NonNullable<PullDetail['myReview']>['state'],
          submittedAt: latest.submitted_at ?? '',
          stale: latest.commit_id !== p.head.sha,
        }
      : null,
    isDraft: !!p.draft,
    additions: p.additions,
    deletions: p.deletions,
    files: files.map(
      (f): PullFile => ({
        path: f.filename,
        sha: f.sha ?? '',
        previousPath: f.previous_filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      }),
    ),
    threads,
    comments: comments.map(
      (c): ReviewComment => ({
        id: c.id,
        inReplyTo: c.in_reply_to_id,
        path: c.path,
        line: c.line ?? null,
        startLine: c.start_line ?? null,
        side: (c.side as ReviewComment['side']) ?? 'RIGHT',
        body: c.body,
        author: c.user?.login ?? 'ghost',
        authorAvatar: smallAvatar(c.user?.avatar_url),
        createdAt: c.created_at,
        url: c.html_url,
        outdated: c.line == null,
      }),
    ),
  }
}

export async function submitReview(input: SubmitReviewInput, drafts: DraftComment[]): Promise<{ url: string }> {
  const octokit = await gh()
  const { owner, repo } = splitRepo(input.repo)
  const plan = planReview(drafts)
  for (const reply of plan.replies) {
    await octokit.pulls.createReplyForReviewComment({ owner, repo, pull_number: input.number, comment_id: reply.commentId, body: reply.body })
  }
  const res = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: input.number,
    commit_id: input.headSha,
    event: input.event,
    body: input.body || undefined,
    comments: plan.lineComments,
  })
  return { url: res.data.html_url }
}

export async function replyToComment({ repo: repoFull, number }: PullRef, commentId: number, body: string) {
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  await octokit.pulls.createReplyForReviewComment({ owner, repo, pull_number: number, comment_id: commentId, body })
}

const fileCache = new Map<string, string | null>()

/** Raw file content at a commit, or null when missing/binary/too large. Cached per sha. */
export async function fetchFileAt(repoFull: string, ref: string, path: string): Promise<string | null> {
  const key = `${repoFull}@${ref}:${path}`
  if (fileCache.has(key)) return fileCache.get(key)!
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  let text: string | null = null
  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref, mediaType: { format: 'raw' } })
    // With the raw media type GitHub returns the file body, which Octokit's types don't model.
    const data: unknown = res.data
    text = typeof data === 'string' ? data : null
    if (text && text.includes('\u0000')) text = null
  } catch {
    text = null
  }
  fileCache.set(key, text)
  return text
}
