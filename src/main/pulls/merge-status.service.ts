import type { Octokit } from '@octokit/rest'
import type { MergeStatus } from '@shared/merge-status.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { MERGE_STATUS_FIELDS, type RawMergeFields, THREAD_FIELDS, toMergeStatus } from './merge-status.util.ts'

const SCOPE_ERROR = /scopes/iu
/** PRs asked about per request: GitHub works merge states out on demand and times out on many at once. */
const BATCH_SIZE = 10
/** A status this fresh is reused: the inbox asks again each time it refreshes. */
const FRESH_MS = 120_000
/** How much of a failure is logged: GitHub's error pages are long HTML. */
const ERROR_CHARS = 120

/** The team half of a reviewer selection, left out when the token may not read team names. */
function buildTeamField(teamSlugs: boolean) {
  if (teamSlugs) {
    return '... on Team { slug }'
  }
  return ''
}

/** The fields of one PR's merge status, without open threads (too costly for many PRs at once). */
const buildPullFields = (teamSlugs: boolean) => /* GraphQL */ `
  isDraft reviewDecision
  latestOpinionatedReviews(first: 20) { nodes { author { login } state } }
  reviewRequests(first: 20) {
    nodes { requestedReviewer { __typename ... on User { login } ${buildTeamField(teamSlugs)} } }
  }
  ${MERGE_STATUS_FIELDS}
`

/** The query for one PR's merge status; team reviewers are named only when the token may read teams. */
const buildQuery = (teamSlugs: boolean) => /* GraphQL */ `
  query ($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
      ${buildPullFields(teamSlugs)}
      ${THREAD_FIELDS}
    } }
  }
`

interface Data {
  repository: { pullRequest: RawMergeFields | null }
}

/** What stands between one PR and merging, fresh from GitHub; without team names when the token lacks read:org. */
export async function fetchMergeStatus(octokit: Octokit, ref: PullRef): Promise<MergeStatus> {
  const { owner, repo } = splitRepo(ref.repo)
  const variables = { owner, repo, number: ref.number }
  let data: Data
  try {
    data = await octokit.graphql<Data>(buildQuery(true), variables)
  } catch (failure) {
    if (!SCOPE_ERROR.test(String(failure))) {
      throw failure
    }
    data = await octokit.graphql<Data>(buildQuery(false), variables)
  }
  const pull = data.repository.pullRequest
  if (!pull) {
    throw new Error(`${ref.repo}#${ref.number} was not found.`)
  }
  return toMergeStatus(pull)
}

/** One request for a batch of PRs, each under its own alias. */
function buildBatchQuery(refs: readonly PullRef[], teamSlugs: boolean) {
  const fields = refs.map((ref, index) => {
    const { owner, repo } = splitRepo(ref.repo)
    return `p${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
      pullRequest(number: ${ref.number}) { ${buildPullFields(teamSlugs)} }
    }`
  })
  return `query { ${fields.join('\n')} }`
}

type BatchData = Record<string, { pullRequest: RawMergeFields | null } | null>

async function fetchBatch(octokit: Octokit, refs: readonly PullRef[]) {
  let data: BatchData
  try {
    data = await octokit.graphql<BatchData>(buildBatchQuery(refs, true))
  } catch (failure) {
    if (!SCOPE_ERROR.test(String(failure))) {
      throw failure
    }
    data = await octokit.graphql<BatchData>(buildBatchQuery(refs, false))
  }
  const statuses: Record<string, MergeStatus> = {}
  for (const [index, ref] of refs.entries()) {
    const pull = data[`p${index}`]?.pullRequest
    if (pull) {
      statuses[buildPullKey(ref)] = toMergeStatus(pull)
    }
  }
  return statuses
}

/**
 * Merge statuses for many PRs (the inbox's), without open threads: a few PRs per request, reusing answers from the
 * last two minutes. A batch GitHub fails on is left out, so those PRs just show no chips.
 */
export class MergeStatusCache {
  private readonly known = new Map<string, { at: number; status: MergeStatus }>()

  async get(octokit: Octokit, refs: readonly PullRef[]): Promise<Record<string, MergeStatus>> {
    const now = Date.now()
    const missing = refs.filter((ref) => (this.known.get(buildPullKey(ref))?.at ?? 0) < now - FRESH_MS)
    // One batch at a time: GitHub works merge states out on demand.
    for (let start = 0; start < missing.length; start += BATCH_SIZE) {
      try {
        const found = await fetchBatch(octokit, missing.slice(start, start + BATCH_SIZE))
        for (const [key, status] of Object.entries(found)) {
          this.known.set(key, { at: Date.now(), status })
        }
      } catch (failure) {
        console.error('[revio] merge status batch failed:', String(failure).slice(0, ERROR_CHARS))
      }
    }
    const statuses: Record<string, MergeStatus> = {}
    for (const ref of refs) {
      const known = this.known.get(buildPullKey(ref))
      if (known) {
        statuses[buildPullKey(ref)] = known.status
      }
    }
    return statuses
  }
}
