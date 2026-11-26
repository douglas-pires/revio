import type { Octokit } from '@octokit/rest'
import type { AfterMergeReport, FollowUp } from '@shared/learn.types.ts'
import { isPresent } from '@shared/presence.util.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { countRewrittenLines } from '@shared/rewritten-lines.util.ts'
import { queryWithRetry } from '../github/graphql-retry.util.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import {
  type ApprovedCandidate,
  collectApproved,
  findLinkedFixes,
  type LineCheck,
  listLineChecks,
  type MergedPull,
  toFollowUp,
} from './follow-ups.util.ts'

/** The approved PRs looked at, most recent first. */
const MAX_APPROVED = 400
/** Approved PRs read per GitHub request. */
const BATCH_SIZE = 6
/** Repositories searched for fixes, and fixes read from each. */
const MAX_REPOS = 8
const FIXES_PER_REPO = 50
const FILES_PER_PULL = 100
const MENTIONS_PER_PULL = 30

interface RawMerged {
  number?: number
  title: string
  body: string
  url: string
  mergedAt: string | null
  author: { login: string } | null
  repository: { nameWithOwner: string }
  files: { nodes: ({ path: string } | null)[] } | null
}

const MERGED_FIELDS = `number title body url mergedAt author { login } repository { nameWithOwner }
  files(first: ${FILES_PER_PULL}) { nodes { path } }`

function toMergedPull(raw: RawMerged | null | undefined): MergedPull | null {
  if (!(raw?.number && raw.mergedAt)) {
    return null
  }
  return {
    repo: raw.repository.nameWithOwner,
    number: raw.number,
    title: raw.title,
    body: raw.body,
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
  const data = await queryWithRetry<Record<string, RawMentions | null>>(octokit, `query { ${fields.join('\n')} }`)
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
  const data = await queryWithRetry<Record<string, { nodes: (RawMerged | null)[] }>>(
    octokit,
    `query { ${searches.join('\n')} }`,
  )
  return Object.values(data).flatMap((result) => result.nodes.map(toMergedPull).filter(isPresent))
}

/** Pairs of diffs compared at most per run: each needs both PRs' diffs. */
const MAX_LINE_CHECKS = 120
/** Lines of the approved PR a fix must remove or rewrite to count as fixing it. */
const MIN_REWRITTEN_LINES = 2

/** A PR's diff by file, as `loadPatches` gives it. */
type LoadPatches = (pull: MergedPull) => Promise<Readonly<Record<string, string | undefined>>>

/** The fixes among the pairs that rewrote enough of the approved PR's lines. */
async function checkRewrittenLines(checks: readonly LineCheck[], loadPatches: LoadPatches) {
  const found: { approved: ApprovedCandidate; followUp: FollowUp }[] = []
  // One pair at a time: each loads two PRs' diffs.
  for (const { approved, fix, sharedFiles } of checks.slice(0, MAX_LINE_CHECKS)) {
    const rewritten = countRewrittenLines(await loadPatches(approved), await loadPatches(fix), sharedFiles)
    if (rewritten >= MIN_REWRITTEN_LINES) {
      found.push({ approved, followUp: toFollowUp(fix, 'rewrote-lines', approved, rewritten) })
    }
  }
  return found
}

/**
 * The PRs you approved that later needed fixing, and which approved PRs were looked at. A later PR counts only on
 * evidence: it reverts the approved PR, says it fixes it, or removed or rewrote lines the approved PR added.
 */
export async function findAfterMergeFixes(
  octokit: Octokit,
  reviews: readonly PastReview[],
  loadPatches: LoadPatches,
): Promise<AfterMergeReport> {
  const approved = listApprovedMerged(reviews)
  const candidates: ApprovedCandidate[] = []
  // One batch at a time, to stay well inside GitHub's limits on concurrent requests.
  for (let start = 0; start < approved.length; start += BATCH_SIZE) {
    candidates.push(...(await fetchBatch(octokit, approved.slice(start, start + BATCH_SIZE))))
  }
  const followUps = new Map(candidates.map((candidate) => [candidate, [...findLinkedFixes(candidate).values()]]))
  const fixes = await fetchFixes(octokit, candidates)
  const checks = candidates.flatMap((candidate) => listLineChecks(candidate, fixes, findLinkedFixes(candidate)))
  for (const { approved: candidate, followUp } of await checkRewrittenLines(checks, loadPatches)) {
    followUps.get(candidate)?.push(followUp)
  }
  const merges = candidates.map((candidate) => candidate.mergedAt).sort((left, right) => left.localeCompare(right))
  return {
    pulls: collectApproved(candidates, followUps),
    examined: candidates.length,
    from: merges[0] ?? null,
    to: merges.at(-1) ?? null,
  }
}
