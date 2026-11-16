import { Octokit } from '@octokit/rest'
import type {
  DraftComment,
  Inbox,
  PullDetail,
  PullFile,
  PullSummary,
  PullThreadStatus,
  ReviewComment,
  SubmitReviewInput,
} from '@shared/types'
import type { ResolvedToken } from './githubAuth'
import { splitRepo } from './repoName'
import type { StackFinder } from './stacks'
import { store } from './store'
import { awaitsYou, classifyRequest, type RawReviewer, type RequestEvent, type ReviewRequest } from './reviewRequest'

let client: { token: string; octokit: Octokit } | null = null
let resolveToken: () => Promise<ResolvedToken> = () => Promise.reject(new Error('GitHub token sources are not set up yet.'))

/** Called once by the composition root with the injected token lookup. */
export function configureTokenResolver(resolve: () => Promise<ResolvedToken>) {
  resolveToken = resolve
  resetClient()
}

export async function gh(): Promise<Octokit> {
  const { token } = await resolveToken()
  if (client?.token !== token) {
    client = { token, octokit: new Octokit({ auth: token, userAgent: 'revio' }) }
    // A different token may have read:org even if the last one did not.
    teamSlugsAllowed = true
  }
  return client.octokit
}

export function resetClient() {
  client = null
  teamSlugsAllowed = true
}


// ---------------------------------------------------------------- inbox

const searchQuery = (teamSlugs: boolean) => /* GraphQL */ `
  query ($requested: String!, $reviewed: String!) {
    viewer { login }
    requested: search(query: $requested, type: ISSUE, first: 50) { nodes { ...pr } }
    reviewed: search(query: $reviewed, type: ISSUE, first: 30) { nodes { ...pr } }
  }
  fragment pr on PullRequest {
    id number title url isDraft createdAt updatedAt additions deletions changedFiles
    headRefName baseRefName reviewDecision
    repository { nameWithOwner defaultBranchRef { name } }
    author { login avatarUrl(size: 64) }
    latestReviews(first: 30) { nodes { author { login } submittedAt } }
    reviewRequests(first: 20) {
      nodes { requestedReviewer { __typename ... on User { login } ${teamSlugs ? '... on Team { slug }' : ''} } }
    }
    timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], last: 30) {
      nodes {
        ... on ReviewRequestedEvent {
          createdAt
          requestedReviewer { __typename ... on User { login } ${teamSlugs ? '... on Team { slug }' : ''} }
        }
      }
    }
  }
`

interface RawPr {
  id: string
  number: number
  title: string
  url: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  additions: number
  deletions: number
  changedFiles: number
  headRefName: string
  baseRefName: string
  reviewDecision: string | null
  repository: { nameWithOwner: string; defaultBranchRef: { name: string } | null }
  author: { login: string; avatarUrl: string } | null
  latestReviews: { nodes: ({ author: { login: string } | null; submittedAt: string | null } | null)[] }
  reviewRequests: { nodes: ({ requestedReviewer: RawReviewer } | null)[] }
  timelineItems: { nodes: (RequestEvent | null)[] }
}

function readReviewRequest(pr: RawPr, viewer: string): ReviewRequest {
  return classifyRequest(
    pr.reviewRequests.nodes.map((n) => n?.requestedReviewer ?? null),
    pr.timelineItems.nodes.filter((n): n is RequestEvent => !!n?.createdAt),
    viewer,
  )
}

const findLastReviewAt = (pr: RawPr, viewer: string) => pr.latestReviews.nodes.find((r) => r?.author?.login === viewer)?.submittedAt ?? null

/** `request` is set for PRs waiting on your review, null for ones you already reviewed. */
function toSummary(pr: RawPr, staleAfterHours: number, request: ReviewRequest | null): PullSummary {
  const isRequested = !!request
  const { viaTeam, requestedAt } = request ?? { viaTeam: null, requestedAt: null }
  const since = new Date(requestedAt ?? pr.createdAt).getTime()
  const waitingHours = (Date.now() - since) / 36e5
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    repo: pr.repository.nameWithOwner,
    author: pr.author?.login ?? 'ghost',
    authorAvatar: pr.author?.avatarUrl ?? '',
    isDraft: pr.isDraft,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    requestedAt,
    viaTeam,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    headRef: pr.headRefName,
    baseRef: pr.baseRefName,
    reviewDecision: pr.reviewDecision,
    defaultBranch: pr.repository.defaultBranchRef?.name ?? 'main',
    waitingHours,
    stale: isRequested && waitingHours >= staleAfterHours,
  }
}

let teamSlugsAllowed = true

export async function fetchInbox(stackFinder: StackFinder): Promise<Inbox> {
  const s = store.settings()
  const who = s.includeTeamRequests ? 'review-requested:@me' : 'user-review-requested:@me'
  const draft = s.ignoreDrafts ? ' draft:false' : ''
  const octokit = await gh()
  type Result = { viewer: { login: string }; requested: { nodes: (RawPr | null)[] }; reviewed: { nodes: (RawPr | null)[] } }
  const vars = {
    requested: `is:open is:pr archived:false ${who}${draft} sort:updated-desc`,
    reviewed: `is:open is:pr archived:false reviewed-by:@me -author:@me${draft} sort:updated-desc`,
  }
  let data: Result
  try {
    data = await octokit.graphql<Result>(searchQuery(teamSlugsAllowed), vars)
  } catch (err) {
    // Team names need the read:org scope, which `gh` tokens often lack. Retry without them.
    if (!teamSlugsAllowed || !/scopes/i.test(String(err))) throw err
    teamSlugsAllowed = false
    data = await octokit.graphql<Result>(searchQuery(false), vars)
  }
  const viewer = data.viewer.login
  const isPr = (n: RawPr | null): n is RawPr => !!n?.id
  // A team request can outlive your review, and search results lag a fresh review: both still match
  // review-requested:@me. Your latest review (always current) settles whether the PR still waits on you.
  const requested: PullSummary[] = []
  const reviewedSinceRequest: PullSummary[] = []
  for (const n of data.requested.nodes.filter(isPr)) {
    const request = readReviewRequest(n, viewer)
    if (awaitsYou(request, findLastReviewAt(n, viewer))) requested.push(toSummary(n, s.staleAfterHours, request))
    else reviewedSinceRequest.push(toSummary(n, s.staleAfterHours, null))
  }
  requested.sort((a, b) => b.waitingHours - a.waitingHours)
  const listed = new Set([...requested, ...reviewedSinceRequest].map((p) => p.id))
  const reviewed = [
    ...reviewedSinceRequest,
    ...data.reviewed.nodes.filter((n): n is RawPr => isPr(n) && !listed.has(n.id)).map((n) => toSummary(n, s.staleAfterHours, null)),
  ]
  const stacks = await stackFinder.stacksForInbox(octokit, requested, reviewed)
  return { viewer, requested, reviewed, stacks, fetchedAt: new Date().toISOString() }
}

// ---------------------------------------------------------------- pull detail

/** Which review threads are resolved; REST comments do not say. A failure only hides that status. */
async function fetchThreadStatus(octokit: Octokit, owner: string, repo: string, number: number): Promise<PullThreadStatus[]> {
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

/** GitHub serves 460px avatars by default; the app shows them at 20–28px. */
function smallAvatar(url: string | undefined) {
  if (!url) return ''
  const u = new URL(url)
  u.searchParams.set('s', '64')
  return u.toString()
}

let cachedViewer: { token: string; login: string } | null = null
async function viewerLogin(): Promise<string> {
  const octokit = await gh()
  if (cachedViewer?.token === client?.token) return cachedViewer!.login
  const { data } = await octokit.users.getAuthenticated()
  cachedViewer = { token: client!.token, login: data.login }
  return data.login
}

export async function fetchPull(repoFull: string, number: number): Promise<PullDetail> {
  const octokit = await gh()
  const { owner, repo } = splitRepo(repoFull)
  const [pr, files, comments, reviews, viewer, threads] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number: number }),
    octokit.paginate(octokit.pulls.listFiles, { owner, repo, pull_number: number, per_page: 100 }),
    octokit.paginate(octokit.pulls.listReviewComments, { owner, repo, pull_number: number, per_page: 100 }),
    octokit.paginate(octokit.pulls.listReviews, { owner, repo, pull_number: number, per_page: 100 }),
    viewerLogin(),
    fetchThreadStatus(octokit, owner, repo, number),
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

// ---------------------------------------------------------------- writing

export async function submitReview(input: SubmitReviewInput, drafts: DraftComment[]): Promise<{ url: string }> {
  const octokit = await gh()
  const { owner, repo } = splitRepo(input.repo)

  // Replies to existing threads cannot be part of a review payload; post them first.
  for (const d of drafts.filter((d) => d.inReplyTo)) {
    await octokit.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: input.number,
      comment_id: d.inReplyTo!,
      body: d.body,
    })
  }

  const comments = drafts
    .filter((d) => !d.inReplyTo)
    .map((d) => ({
      path: d.path,
      body: d.body,
      line: d.line,
      side: d.side,
      ...(d.startLine && d.startLine !== d.line ? { start_line: d.startLine, start_side: d.side } : {}),
    }))

  const res = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: input.number,
    commit_id: input.headSha,
    event: input.event,
    body: input.body || undefined,
    comments,
  })
  return { url: res.data.html_url }
}

export async function replyToComment(repoFull: string, number: number, commentId: number, body: string) {
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

