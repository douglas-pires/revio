import type { Octokit } from '@octokit/rest'
import type { Inbox, PullSummary } from '@shared/inbox.types.ts'
import type { Settings } from '@shared/settings.types.ts'
import { MS_PER_HOUR } from '@shared/time.util.ts'
import { gh, tokenInUse } from '../github/github.client.ts'
import type { StackFinder } from '../stacks/stacks.service.ts'
import { store } from '../store/store.service.ts'
import {
  awaitsYou,
  classifyRequest,
  type RawReviewer,
  type RequestEvent,
  type ReviewRequest,
} from './review-request.util.ts'

const SCOPE_ERROR = /scopes/iu

/** The team half of a reviewer selection, left out when the token may not read team names. */
function teamField(teamSlugs: boolean) {
  if (teamSlugs) {
    return '... on Team { slug }'
  }
  return ''
}

const searchQuery = (teamSlugs: boolean) => /* GraphQL */ `
  query ($requested: String!, $reviewed: String!, $authored: String!) {
    viewer { login }
    requested: search(query: $requested, type: ISSUE, first: 50) { nodes { ...pr } }
    reviewed: search(query: $reviewed, type: ISSUE, first: 30) { nodes { ...pr } }
    authored: search(query: $authored, type: ISSUE, first: 50) { nodes { ...pr } }
  }
  fragment pr on PullRequest {
    id number title url isDraft createdAt updatedAt additions deletions changedFiles
    headRefName baseRefName reviewDecision
    repository { nameWithOwner defaultBranchRef { name } }
    author { login avatarUrl(size: 64) }
    latestReviews(first: 30) { nodes { author { login } submittedAt } }
    reviewRequests(first: 20) {
      nodes { requestedReviewer { __typename ... on User { login } ${teamField(teamSlugs)} } }
    }
    timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], last: 30) {
      nodes {
        ... on ReviewRequestedEvent {
          createdAt
          requestedReviewer { __typename ... on User { login } ${teamField(teamSlugs)} }
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
    pr.reviewRequests.nodes.map((node) => node?.requestedReviewer ?? null),
    pr.timelineItems.nodes.filter((node): node is RequestEvent => Boolean(node?.createdAt)),
    viewer,
  )
}

const findLastReviewAt = (pr: RawPr, viewer: string) =>
  pr.latestReviews.nodes.find((review) => review?.author?.login === viewer)?.submittedAt ?? null

/** `request` is set for PRs waiting on your review, null for ones you already reviewed. */
function toSummary(pr: RawPr, staleAfterHours: number, request: ReviewRequest | null, viewer: string): PullSummary {
  const isRequested = Boolean(request)
  const { viaTeam, requestedAt } = request ?? { viaTeam: null, requestedAt: null }
  const since = new Date(requestedAt ?? pr.createdAt).getTime()
  const waitingHours = (Date.now() - since) / MS_PER_HOUR
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
    yourLastReviewAt: findLastReviewAt(pr, viewer),
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

/** The token GitHub refused team names for (no read:org); a different token gets to try again. */
let teamNamesRefusedFor: string | null = null

const teamNamesAllowed = () => teamNamesRefusedFor !== tokenInUse()

interface InboxSearch {
  viewer: { login: string }
  requested: { nodes: (RawPr | null)[] }
  reviewed: { nodes: (RawPr | null)[] }
  authored: { nodes: (RawPr | null)[] }
}

type InboxSearches = ReturnType<typeof buildInboxSearches>

function buildInboxSearches(settings: Pick<Settings, 'includeTeamRequests' | 'ignoreDrafts'>) {
  let who = 'user-review-requested:@me'
  if (settings.includeTeamRequests) {
    who = 'review-requested:@me'
  }
  let draft = ''
  if (settings.ignoreDrafts) {
    draft = ' draft:false'
  }
  return {
    requested: `is:open is:pr archived:false ${who}${draft} sort:updated-desc`,
    reviewed: `is:open is:pr archived:false reviewed-by:@me -author:@me${draft} sort:updated-desc`,
    // Your drafts are your work in progress, so they are listed whatever the drafts setting says.
    authored: 'is:open is:pr archived:false author:@me sort:updated-desc',
  }
}

/** Team names need the read:org scope, which `gh` tokens often lack: on a scope error, retry without them. */
async function searchInbox(octokit: Octokit, searches: InboxSearches): Promise<InboxSearch> {
  try {
    return await octokit.graphql<InboxSearch>(searchQuery(teamNamesAllowed()), searches)
  } catch (err) {
    if (!(teamNamesAllowed() && SCOPE_ERROR.test(String(err)))) {
      throw err
    }
    teamNamesRefusedFor = tokenInUse()
    return octokit.graphql<InboxSearch>(searchQuery(false), searches)
  }
}

/**
 * Requests still waiting on you, longest first, and PRs you reviewed. A team request can outlive your review
 * and search lags a fresh one, so your latest review (always current) settles whether a PR still waits on you.
 */
function sortInbox(data: InboxSearch, viewer: string, staleAfterHours: number) {
  const requested: PullSummary[] = []
  const reviewedSinceRequest: PullSummary[] = []
  for (const pr of data.requested.nodes.filter(isPr)) {
    const request = readReviewRequest(pr, viewer)
    if (awaitsYou(request, findLastReviewAt(pr, viewer))) {
      requested.push(toSummary(pr, staleAfterHours, request, viewer))
    } else {
      reviewedSinceRequest.push(toSummary(pr, staleAfterHours, null, viewer))
    }
  }
  requested.sort((left, right) => right.waitingHours - left.waitingHours)
  const listed = new Set([...requested, ...reviewedSinceRequest].map((pull) => pull.id))
  const otherReviewed = data.reviewed.nodes.filter((node): node is RawPr => isPr(node) && !listed.has(node.id))
  return {
    requested,
    reviewed: [...reviewedSinceRequest, ...otherReviewed.map((pr) => toSummary(pr, staleAfterHours, null, viewer))],
  }
}

const isPr = (node: RawPr | null): node is RawPr => Boolean(node?.id)

export async function fetchInbox(stackFinder: StackFinder): Promise<Inbox> {
  const settings = store.settings()
  const octokit = await gh()
  const data = await searchInbox(octokit, buildInboxSearches(settings))
  const viewer = data.viewer.login
  const { requested, reviewed } = sortInbox(data, viewer, settings.staleAfterHours)
  const authored = data.authored.nodes.filter(isPr).map((pr) => toSummary(pr, settings.staleAfterHours, null, viewer))
  const stacks = await stackFinder.stacksForInbox(octokit, requested, reviewed)
  return { viewer, requested, reviewed, authored, stacks, fetchedAt: new Date().toISOString() }
}
