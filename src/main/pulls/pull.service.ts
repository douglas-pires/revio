import type { Octokit } from '@octokit/rest'
import { readErrorMessage } from '@shared/error.util.ts'
import { isPresent } from '@shared/presence.util.ts'
import type { PullDetail, PullFile, PullRef, PullThreadStatus, ReviewComment } from '@shared/pull.types.ts'
import type { ReactionSummary } from '@shared/reaction.types.ts'
import { type RawReactionGroup, toReactionSummaries } from '@shared/reaction.util.ts'
import { MemoCache } from '../common/memo.cache.ts'
import { buildSmallAvatarUrl, getGithubClient, getViewerLogin } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { REACTION_GROUPS } from '../reactions/reactions.service.ts'
import { buildConversation } from './conversation.util.ts'

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
    const comments = nodes.flatMap((thread) => thread.comments.nodes.filter(isPresent))
    return {
      threads: nodes
        .map((thread) => ({
          id: thread.id,
          rootCommentId: thread.comments.nodes[0]?.databaseId,
          resolved: thread.isResolved,
        }))
        .filter((thread): thread is PullThreadStatus => Boolean(thread.rootCommentId)),
      reactions: new Map(
        comments.map((comment) => [comment.databaseId, toReactionSummaries(comment.reactionGroups ?? [])]),
      ),
    }
  } catch (err) {
    console.error('[revio] thread status lookup failed:', readErrorMessage(err))
    return { threads: [], reactions: new Map() }
  }
}

/** Whole files are large, so only the most recent ones are kept; concurrent requests for one share a fetch. */
const fileCache = new MemoCache<string | null>(MAX_CACHED_FILES)

async function loadFileAt(repoFull: string, ref: string, path: string): Promise<string | null> {
  const octokit = await getGithubClient()
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
function findMyReview(reviews: readonly RestReview[], viewer: string, headSha: string): PullDetail['myReview'] {
  const mine = reviews.filter((review) => review.user?.login === viewer && review.state !== 'PENDING')
  const latest = mine.filter((review) => DECISIVE_STATES.has(review.state)).at(-1) ?? mine.at(-1)
  if (!latest) {
    return null
  }
  return {
    state: latest.state as NonNullable<PullDetail['myReview']>['state'],
    submittedAt: latest.submitted_at ?? '',
    stale: latest.commit_id !== headSha,
  }
}

/** When you last submitted a review, of any kind. */
function findLastReviewedAt(reviews: readonly RestReview[], viewer: string): string | null {
  const times = reviews
    .filter((review) => review.user?.login === viewer && review.state !== 'PENDING' && isPresent(review.submitted_at))
    .map((review) => review.submitted_at ?? '')
    .sort()
  return times.at(-1) ?? null
}

function toPullFile(file: RestFile): PullFile {
  return {
    path: file.filename,
    sha: file.sha ?? '',
    previousPath: file.previous_filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch,
  }
}

function pickSubjectType(onFile: boolean): ReviewComment['subjectType'] {
  if (onFile) {
    return 'file'
  }
  return 'line'
}

function toReviewComment(comment: RestComment, reactions: ThreadMeta['reactions']): ReviewComment {
  const onFile = comment.subject_type === 'file'
  return {
    id: comment.id,
    nodeId: comment.node_id,
    inReplyTo: comment.in_reply_to_id,
    path: comment.path,
    line: comment.line ?? null,
    startLine: comment.start_line ?? null,
    side: (comment.side as ReviewComment['side']) ?? 'RIGHT',
    body: comment.body,
    author: comment.user?.login ?? 'ghost',
    authorAvatar: buildSmallAvatarUrl(comment.user?.avatar_url),
    createdAt: comment.created_at,
    url: comment.html_url,
    // A line comment loses its line once the code it was on changes; a file comment never had one.
    outdated: !(onFile || isPresent(comment.line)),
    subjectType: pickSubjectType(onFile),
    reactions: reactions.get(comment.id) ?? [],
  }
}

export async function fetchPull(ref: PullRef): Promise<PullDetail> {
  const { repo: repoFull, number } = ref
  const octokit = await getGithubClient()
  const { owner, repo } = splitRepo(repoFull)
  const list = { owner, repo, pull_number: number, per_page: PAGE_SIZE }
  const [pr, files, comments, reviews, conversationComments, viewer, meta] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number: number }),
    octokit.paginate(octokit.pulls.listFiles, list),
    octokit.paginate(octokit.pulls.listReviewComments, list),
    octokit.paginate(octokit.pulls.listReviews, list),
    octokit.paginate(octokit.issues.listComments, { owner, repo, issue_number: number, per_page: PAGE_SIZE }),
    getViewerLogin(),
    fetchThreadMeta(octokit, ref),
  ])
  const pullData = pr.data
  return {
    fetchedAt: new Date().toISOString(),
    repo: repoFull,
    number,
    title: pullData.title,
    body: pullData.body ?? '',
    url: pullData.html_url,
    author: pullData.user?.login ?? 'ghost',
    authorAvatar: buildSmallAvatarUrl(pullData.user?.avatar_url),
    headRef: pullData.head.ref,
    baseRef: pullData.base.ref,
    headSha: pullData.head.sha,
    baseSha: pullData.base.sha,
    viewer,
    myReview: findMyReview(reviews, viewer, pullData.head.sha),
    lastReviewedAt: findLastReviewedAt(reviews, viewer),
    isDraft: Boolean(pullData.draft),
    additions: pullData.additions,
    deletions: pullData.deletions,
    commitCount: pullData.commits,
    files: files.map(toPullFile),
    threads: meta.threads,
    comments: comments.map((comment) => toReviewComment(comment, meta.reactions)),
    conversation: buildConversation(conversationComments, reviews, buildSmallAvatarUrl),
  }
}

/** Raw file content at a commit, or null when missing/binary/too large. Cached per sha. */
export function fetchFileAt(repoFull: string, ref: string, path: string): Promise<string | null> {
  return fileCache.get(`${repoFull}@${ref}:${path}`, () => loadFileAt(repoFull, ref, path))
}
