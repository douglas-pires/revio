import type { Octokit } from '@octokit/rest'
import type { DraftComment, PullDetail, PullFile, PullRef, PullThreadStatus, ReviewComment, ReviewEvent, SubmitReviewInput } from '@shared/pull.types'
import { gh, smallAvatar, viewerLogin } from '../github/github.client'
import { splitRepo } from '../github/repo-name.util'
import { planReview, type ReviewPlan } from './review-plan.util'
import type { ReactionSummary } from '@shared/reaction.types'
import { toReactionSummaries, type RawReactionGroup } from '@shared/reaction.util'
import { REACTION_GROUPS } from '../reactions/reactions.service'
import { MemoCache } from '../common/memo.cache'

interface ThreadMeta {
  threads: PullThreadStatus[]
  /** Reactions per review comment id. */
  reactions: Map<number, ReactionSummary[]>
}

/** Thread resolution and comment reactions, which REST does not give. Empty if GitHub would not say. */
async function fetchThreadMeta(octokit: Octokit, ref: PullRef): Promise<ThreadMeta> {
  const { owner, repo } = splitRepo(ref.repo)
  const { number } = ref
  type RawComment = { databaseId: number; reactionGroups: RawReactionGroup[] | null }
  type Data = { repository: { pullRequest: { reviewThreads: { nodes: ({ id: string; isResolved: boolean; comments: { nodes: (RawComment | null)[] } } | null)[] } } | null } }
  try {
    const data = await octokit.graphql<Data>(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
          reviewThreads(first: 100) { nodes { id isResolved comments(first: 50) { nodes { databaseId ${REACTION_GROUPS} } } } }
        } }
      }`,
      { owner, repo, number },
    )
    const nodes = (data.repository.pullRequest?.reviewThreads.nodes ?? []).flatMap((t) => (t ? [t] : []))
    const comments = nodes.flatMap((t) => t.comments.nodes.flatMap((c) => (c ? [c] : [])))
    return {
      threads: nodes.flatMap((t) => {
        const rootCommentId = t.comments.nodes[0]?.databaseId
        return rootCommentId ? [{ id: t.id, rootCommentId, resolved: t.isResolved }] : []
      }),
      reactions: new Map(comments.map((c) => [c.databaseId, toReactionSummaries(c.reactionGroups ?? [])])),
    }
  } catch (err) {
    console.error('[revio] thread status lookup failed:', err instanceof Error ? err.message : err)
    return { threads: [], reactions: new Map() }
  }
}

export async function fetchPull(ref: PullRef): Promise<PullDetail> {
  const { repo: repoFull, number } = ref
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  const [pr, files, comments, reviews, viewer, meta] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number: number }),
    octokit.paginate(octokit.pulls.listFiles, { owner, repo, pull_number: number, per_page: 100 }),
    octokit.paginate(octokit.pulls.listReviewComments, { owner, repo, pull_number: number, per_page: 100 }),
    octokit.paginate(octokit.pulls.listReviews, { owner, repo, pull_number: number, per_page: 100 }),
    viewerLogin(),
    fetchThreadMeta(octokit, ref),
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
    commitCount: p.commits,
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
    threads: meta.threads,
    comments: comments.map(
      (c): ReviewComment => ({
        id: c.id,
        nodeId: c.node_id,
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
        // A line comment loses its line once the code it was on changes; a file comment never had one.
        outdated: c.subject_type !== 'file' && c.line == null,
        subjectType: c.subject_type === 'file' ? 'file' : 'line',
        reactions: meta.reactions.get(c.id) ?? [],
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
  const review = { owner, repo, pull_number: input.number, commit_id: input.headSha, body: input.body || undefined, comments: plan.lineComments }
  if (!plan.fileComments.length) {
    const res = await octokit.pulls.createReview({ ...review, event: input.event })
    return { url: res.data.html_url }
  }
  return submitWithFileComments(octokit, review, plan.fileComments, input.event)
}

// A type alias (not an interface) so it fits Octokit's index-signature parameter type.
type ReviewDraft = {
  owner: string
  repo: string
  pull_number: number
  commit_id: string
  body?: string
  comments: ReviewPlan['lineComments']
}

/**
 * File comments can only join a review through GraphQL: create the review pending, add each file as a
 * thread, then submit. A failure deletes the pending review so nothing is left half-posted.
 */
async function submitWithFileComments(octokit: Octokit, review: ReviewDraft, files: ReviewPlan['fileComments'], event: ReviewEvent) {
  const pending = await octokit.pulls.createReview(review)
  const ids = { owner: review.owner, repo: review.repo, pull_number: review.pull_number, review_id: pending.data.id }
  try {
    for (const f of files) await addFileThread(octokit, pending.data.node_id, f)
    const res = await octokit.pulls.submitReview({ ...ids, event, body: review.body })
    return { url: res.data.html_url }
  } catch (err) {
    await octokit.pulls.deletePendingReview(ids).catch(() => {})
    throw err
  }
}

async function addFileThread(octokit: Octokit, reviewId: string, { path, body }: { path: string; body: string }) {
  await octokit.graphql(
    `mutation ($review: ID!, $path: String!, $body: String!) {
      addPullRequestReviewThread(input: { pullRequestReviewId: $review, path: $path, body: $body, subjectType: FILE }) { thread { id } }
    }`,
    { review: reviewId, path, body },
  )
}

export async function replyToComment({ repo: repoFull, number }: PullRef, commentId: number, body: string) {
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  await octokit.pulls.createReplyForReviewComment({ owner, repo, pull_number: number, comment_id: commentId, body })
}

/** Posts a comment in the PR conversation (not on code) and returns its link. */
export async function commentOnPull({ repo: repoFull, number }: PullRef, body: string): Promise<{ url: string }> {
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  const { data } = await octokit.issues.createComment({ owner, repo, issue_number: number, body })
  return { url: data.html_url }
}

/** Whole files are large, so only the most recent ones are kept; concurrent requests for one share a fetch. */
const fileCache = new MemoCache<string | null>(50)

/** Raw file content at a commit, or null when missing/binary/too large. Cached per sha. */
export function fetchFileAt(repoFull: string, ref: string, path: string): Promise<string | null> {
  return fileCache.get(`${repoFull}@${ref}:${path}`, () => loadFileAt(repoFull, ref, path))
}

async function loadFileAt(repoFull: string, ref: string, path: string): Promise<string | null> {
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
  return text
}
