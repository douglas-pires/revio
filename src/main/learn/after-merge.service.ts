import type { Octokit } from '@octokit/rest'
import type { ApprovedPull } from '@shared/learn.types.ts'
import { isPresent } from '@shared/presence.util.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { type ApprovedCandidate, type MergedPull, matchFollowUps } from './follow-ups.util.ts'

/** The approved PRs looked at, most recent first. */
const MAX_APPROVED = 60
/** Approved PRs read per GitHub request. */
const BATCH_SIZE = 15
/** Repositories searched for fixes, and fixes read from each. */
const MAX_REPOS = 8
const FIXES_PER_REPO = 100
const FILES_PER_PULL = 100
const MENTIONS_PER_PULL = 30

interface RawMerged {
  number?: number
  title: string
  url: string
  mergedAt: string | null
  author: { login: string } | null
  repository: { nameWithOwner: string }
  files: { nodes: ({ path: string } | null)[] } | null
}

const MERGED_FIELDS = `number title url mergedAt author { login } repository { nameWithOwner }
  files(first: ${FILES_PER_PULL}) { nodes { path } }`

function toMergedPull(raw: RawMerged | null | undefined): MergedPull | null {
  if (!(raw?.number && raw.mergedAt)) {
    return null
  }
  return {
    repo: raw.repository.nameWithOwner,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    author: raw.author?.login ?? 'ghost',
    mergedAt: raw.mergedAt,
    files: (raw.files?.nodes ?? []).filter(isPresent).map((file) => file.path),
  }
}

/** Your reviews grouped by PR: the merged ones you approved, with when you last approved, newest first. */
export function listApprovedMerged(reviews: readonly PastReview[]) {
  const byPull = new Map<string, PastReview & { approvedAt: string }>()
  for (const review of reviews) {
    const key = `${review.repo}#${review.number}`
    const seen = byPull.get(key)
    if (review.state === 'APPROVED' && review.mergedAt && !(seen && seen.approvedAt >= review.submittedAt)) {
      byPull.set(key, { ...review, approvedAt: review.submittedAt })
    }
  }
  return [...byPull.values()]
    .sort((left, right) => (right.mergedAt ?? '').localeCompare(left.mergedAt ?? ''))
    .slice(0, MAX_APPROVED)
}

interface RawMentions {
  pullRequest: (RawMerged & { timelineItems: { nodes: ({ source?: RawMerged | null } | null)[] } }) | null
}

/** One batch of approved PRs, with their files and the merged PRs that mention them. */
async function fetchBatch(octokit: Octokit, batch: ReturnType<typeof listApprovedMerged>) {
  const fields = batch.map((review, index) => {
    const { owner, repo } = splitRepo(review.repo)
    return `p${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
      pullRequest(number: ${review.number}) { ${MERGED_FIELDS}
        timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: ${MENTIONS_PER_PULL}) {
          nodes { ... on CrossReferencedEvent { source { ... on PullRequest { ${MERGED_FIELDS} } } } }
        }
      }
    }`
  })
  const data = await octokit.graphql<Record<string, RawMentions | null>>(`query { ${fields.join('\n')} }`)
  return batch.flatMap((review, index): ApprovedCandidate[] => {
    const raw = data[`p${index}`]?.pullRequest
    const pull = toMergedPull(raw)
    if (!(raw && pull)) {
      return []
    }
    const mentionedBy = raw.timelineItems.nodes.map((node) => toMergedPull(node?.source)).filter(isPresent)
    return [{ ...pull, approvedAt: review.approvedAt, mentionedBy }]
  })
}

/** Merged PRs with a fix-like title in each repository, since the oldest approved PR merged. */
async function fetchFixes(octokit: Octokit, approved: readonly ApprovedCandidate[]) {
  const oldestByRepo = new Map<string, string>()
  for (const pull of approved) {
    const oldest = oldestByRepo.get(pull.repo)
    if (!oldest || pull.mergedAt < oldest) {
      oldestByRepo.set(pull.repo, pull.mergedAt)
    }
  }
  const searches = [...oldestByRepo].slice(0, MAX_REPOS).map(([repo, since], index) => {
    const query = `repo:${repo} is:pr is:merged merged:>=${since.slice(0, 'yyyy-mm-dd'.length)} fix OR revert OR bug OR hotfix OR regression in:title`
    return `r${index}: search(query: ${JSON.stringify(query)}, type: ISSUE, first: ${FIXES_PER_REPO}) {
      nodes { ... on PullRequest { ${MERGED_FIELDS} } }
    }`
  })
  if (searches.length === 0) {
    return []
  }
  const data = await octokit.graphql<Record<string, { nodes: (RawMerged | null)[] }>>(
    `query { ${searches.join('\n')} }`,
  )
  return Object.values(data).flatMap((result) => result.nodes.map(toMergedPull).filter(isPresent))
}

/** The PRs you approved in the last year that later needed fixing, with the fixes. */
export async function findAfterMergeFixes(octokit: Octokit, reviews: readonly PastReview[]): Promise<ApprovedPull[]> {
  const approved = listApprovedMerged(reviews)
  const candidates: ApprovedCandidate[] = []
  for (let start = 0; start < approved.length; start += BATCH_SIZE) {
    candidates.push(...(await fetchBatch(octokit, approved.slice(start, start + BATCH_SIZE))))
  }
  return matchFollowUps(candidates, await fetchFixes(octokit, candidates))
}
