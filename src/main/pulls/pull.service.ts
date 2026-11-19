import type { Octokit } from '@octokit/rest'
import { errorMessage } from '@shared/error.util.ts'
import { isPresent } from '@shared/presence.util.ts'
import type {
  DraftComment,
  PullDetail,
  PullFile,
  PullRef,
  PullThreadStatus,
  ReviewComment,
  ReviewEvent,
  SubmitReviewInput,
} from '@shared/pull.types.ts'
import type { ReactionSummary } from '@shared/reaction.types.ts'
import { type RawReactionGroup, toReactionSummaries } from '@shared/reaction.util.ts'
import { MemoCache } from '../common/memo.cache.ts'
import { gh, smallAvatar, viewerLogin } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { REACTION_GROUPS } from '../reactions/reactions.service.ts'
import { planReview, type ReviewPlan } from './review-plan.util.ts'

/** Whole files are large, so only this many recent ones are kept. */
const MAX_CACHED_FILES = 50
/** GitHub's largest page size for these lists. */
const PAGE_SIZE = 100
const DECISIVE_STATES = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'])

interface ThreadMeta {
  threads: PullThreadStatus[]
  /** Reactions per review comment id. */
  reactions: Map<number, ReactionSummary[]>
}

/** Thread resolution and comment reactions, which REST does not give. Empty if GitHub would not say. */
async function fetchThreadMeta(octokit: Octokit, ref: PullRef): Promise<ThreadMeta> {
  const { owner, repo } = splitRepo(ref.repo)
  const { number } = ref
  interface RawComment {
    databaseId: number
    reactionGroups: RawReactionGroup[] | null
  }
  interface Data {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: ({ id: string; isResolved: boolean; comments: { nodes: (RawComment | null)[] } } | null)[]
        }
      } | null
    }
  }
  try {
    const data = await octokit.graphql<Data>(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
          reviewThreads(first: 100) { nodes { id isResolved comments(first: 50) { nodes { databaseId ${REACTION_GROUPS} } } } }
        } }
      }`,
      { owner, repo, number },
    )
    const nodes = (data.repository.pullRequest?.reviewThreads.nodes ?? []).filter(isPresent)
    const comments = nodes.flatMap((t) => t.comments.nodes.filter(isPresent))
    return {
      threads: nodes
        .map((t) => ({ id: t.id, rootCommentId: t.comments.nodes[0]?.databaseId, resolved: t.isResolved }))
        .filter((t): t is PullThreadStatus => Boolean(t.rootCommentId)),
      reactions: new Map(comments.map((c) => [c.databaseId, toReactionSummaries(c.reactionGroups ?? [])])),
    }
  } catch (err) {
    console.error('[revio] thread status lookup failed:', errorMessage(err))
    return { threads: [], reactions: new Map() }
  }
}

// biome-ignore lint/style/useConsistentTypeDefinitions: a type alias, unlike an interface, fits Octokit's index-signature parameter type.
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
async function submitWithFileComments(
  octokit: Octokit,
  review: ReviewDraft,
  files: ReviewPlan['fileComments'],
  event: ReviewEvent,
) {
  const pending = await octokit.pulls.createReview(review)
  const ids = { owner: review.owner, repo: review.repo, pull_number: review.pull_number, review_id: pending.data.id }
  try {
    for (const f of files) {
      // biome-ignore lint/performance/noAwaitInLoops: threads are added one at a time so they keep the order they were drafted in.
      await addFileThread(octokit, pending.data.node_id, f)
    }
    const res = await octokit.pulls.submitReview({ ...ids, event, ...(review.body && { body: review.body }) })
    return { url: res.data.html_url }
  } catch (err) {
    await octokit.pulls.deletePendingReview(ids).catch(() => {
      // Best effort: the original error is the one worth reporting.
    })
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

/** Whole files are large, so only the most recent ones are kept; concurrent requests for one share a fetch. */
const fileCache = new MemoCache<string | null>(MAX_CACHED_FILES)

async function loadFileAt(repoFull: string, ref: string, path: string): Promise<string | null> {
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  // With the raw media type GitHub returns the file body, which Octokit's types don't model.
  const data: unknown = await octokit.repos
    .getContent({ owner, repo, path, ref, mediaType: { format: 'raw' } })
    .then((res) => res.data as unknown)
    .catch(() => null)
  // A NUL byte means a binary file, which the app does not show.
  if (typeof data !== 'string' || data.includes('\u0000')) {
    return null
  }
  return data
}

interface RestReview {
  user?: { login: string } | null
  state: string
  submitted_at?: string
  commit_id: string | null
}
type RestFile = Awaited<ReturnType<Octokit['pulls']['listFiles']>>['data'][number]
type RestComment = Awaited<ReturnType<Octokit['pulls']['listReviewComments']>>['data'][number]

/** Your most recent decisive review (approve, request changes, dismissed), else your latest comment review. */
function myReviewOf(reviews: readonly RestReview[], viewer: string, headSha: string): PullDetail['myReview'] {
  const mine = reviews.filter((r) => r.user?.login === viewer && r.state !== 'PENDING')
  const latest = mine.filter((r) => DECISIVE_STATES.has(r.state)).at(-1) ?? mine.at(-1)
  if (!latest) {
    return null
  }
  return {
    state: latest.state as NonNullable<PullDetail['myReview']>['state'],
    submittedAt: latest.submitted_at ?? '',
    stale: latest.commit_id !== headSha,
  }
}

function toPullFile(f: RestFile): PullFile {
  return {
    path: f.filename,
    sha: f.sha ?? '',
    previousPath: f.previous_filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }
}

function subjectTypeOf(onFile: boolean): ReviewComment['subjectType'] {
  if (onFile) {
    return 'file'
  }
  return 'line'
}

function toReviewComment(c: RestComment, reactions: ThreadMeta['reactions']): ReviewComment {
  const onFile = c.subject_type === 'file'
  return {
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
    outdated: !(onFile || isPresent(c.line)),
    subjectType: subjectTypeOf(onFile),
    reactions: reactions.get(c.id) ?? [],
  }
}

export async function fetchPull(ref: PullRef): Promise<PullDetail> {
  const { repo: repoFull, number } = ref
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  const list = { owner, repo, pull_number: number, per_page: PAGE_SIZE }
  const [pr, files, comments, reviews, viewer, meta] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number: number }),
    octokit.paginate(octokit.pulls.listFiles, list),
    octokit.paginate(octokit.pulls.listReviewComments, list),
    octokit.paginate(octokit.pulls.listReviews, list),
    viewerLogin(),
    fetchThreadMeta(octokit, ref),
  ])
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
    myReview: myReviewOf(reviews, viewer, p.head.sha),
    isDraft: Boolean(p.draft),
    additions: p.additions,
    deletions: p.deletions,
    commitCount: p.commits,
    files: files.map(toPullFile),
    threads: meta.threads,
    comments: comments.map((c) => toReviewComment(c, meta.reactions)),
  }
}

export async function submitReview(input: SubmitReviewInput, drafts: DraftComment[]): Promise<{ url: string }> {
  const octokit = await gh()
  const { owner, repo } = splitRepo(input.repo)
  const plan = planReview(drafts)
  for (const reply of plan.replies) {
    // biome-ignore lint/performance/noAwaitInLoops: replies are posted in the order they were written.
    await octokit.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: input.number,
      comment_id: reply.commentId,
      body: reply.body,
    })
  }
  const review: ReviewDraft = {
    owner,
    repo,
    pull_number: input.number,
    commit_id: input.headSha,
    comments: plan.lineComments,
  }
  if (input.body) {
    review.body = input.body
  }
  if (plan.fileComments.length === 0) {
    const res = await octokit.pulls.createReview({ ...review, event: input.event })
    return { url: res.data.html_url }
  }
  return submitWithFileComments(octokit, review, plan.fileComments, input.event)
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

/** Raw file content at a commit, or null when missing/binary/too large. Cached per sha. */
export function fetchFileAt(repoFull: string, ref: string, path: string): Promise<string | null> {
  return fileCache.get(`${repoFull}@${ref}:${path}`, () => loadFileAt(repoFull, ref, path))
}
