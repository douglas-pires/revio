import type { Octokit } from '@octokit/rest'
import { errorMessage } from '@shared/error.util.ts'
import type { Inbox, PullSummary, Stack } from '@shared/inbox.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { MS_PER_MINUTE } from '@shared/time.util.ts'
import { gh } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import {
  buildStacks,
  type InboxTag,
  type MiniPr,
  markStackPositions,
  summaryToMini,
  tagInbox,
  withInboxTags,
} from './stack-graph.util.ts'

/** Stacks are re-walked at most this often while the inbox's PRs and branches stay the same. */
const STACK_TTL_MINUTES = 15
const STACK_TTL_MS = STACK_TTL_MINUTES * MS_PER_MINUTE

/** How many rounds of branch links to follow up and down from the seeds. */
const MAX_ROUNDS = 5

/** Aliased lookups batched into one GraphQL query. */
const LOOKUPS_PER_QUERY = 40

const MINI = `id number title url isDraft headRefName baseRefName reviewDecision
  author { login avatarUrl(size: 64) } repository { nameWithOwner defaultBranchRef { name } }`

/** Changes whenever a PR joins or leaves the inbox, moves branches, or changes review decision. */
const signInbox = (prs: PullSummary[]) =>
  prs
    .map((pr) => `${pr.id}:${pr.headRef}:${pr.baseRef}:${pr.reviewDecision}`)
    .sort((left, right) => left.localeCompare(right))
    .join('|')

const collectStaleIds = (prs: PullSummary[]) => new Set(prs.filter((pr) => pr.stale).map((pr) => pr.id))

async function fetchMiniPr(octokit: Octokit, { repo: repoFull, number }: PullRef) {
  const { owner, repo } = splitRepo(repoFull)
  const data = await octokit.graphql<{ repository: { pullRequest: MiniPr | null } }>(
    `query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { pullRequest(number: $number) { ${MINI} } } }`,
    { owner, repo, number },
  )
  return data.repository.pullRequest
}

/** Stacks containing at least one seed PR. */
async function findStacks(octokit: Octokit, seeds: MiniPr[], tag: InboxTag, staleIds: Set<string>): Promise<Stack[]> {
  const prs = await collectLinkedPrs(octokit, seeds)
  return buildStacks(prs.values(), new Set(seeds.map((seed) => seed.id)), tag, staleIds)
}

/** Follows branch links up (the PR my base branch belongs to) and down (PRs based on my head branch). */
async function collectLinkedPrs(octokit: Octokit, seeds: MiniPr[]): Promise<Map<string, MiniPr>> {
  const prs = new Map(seeds.map((seed) => [seed.id, seed]))
  const asked = new Set<string>()
  let frontier = seeds
  for (let round = 0; round < MAX_ROUNDS && frontier.length > 0; round += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each round looks up the PRs the previous round found.
    const found = await runLookups(octokit, planLookups(frontier, asked))
    frontier = found.filter((foundPull) => !prs.has(foundPull.id))
    for (const pull of frontier) {
      prs.set(pull.id, pull)
    }
  }
  return prs
}

interface Lookup {
  repo: string
  field: 'headRefName' | 'baseRefName'
  ref: string
  first: number
}

/** The branch lookups this round still needs; `asked` remembers earlier rounds so none repeats. */
function planLookups(frontier: MiniPr[], asked: Set<string>): Lookup[] {
  const lookups: Lookup[] = []
  const add = (lookup: Lookup) => {
    const key = `${lookup.repo}|${lookup.field}|${lookup.ref}`
    if (asked.has(key)) {
      return
    }
    asked.add(key)
    lookups.push(lookup)
  }
  for (const pull of frontier) {
    const repo = pull.repository.nameWithOwner
    const defaultBranch = pull.repository.defaultBranchRef?.name
    if (pull.baseRefName !== defaultBranch) {
      add({ repo, field: 'headRefName', ref: pull.baseRefName, first: 1 })
    }
    if (pull.headRefName !== defaultBranch) {
      add({ repo, field: 'baseRefName', ref: pull.headRefName, first: 10 })
    }
  }
  return lookups
}

async function runLookups(octokit: Octokit, lookups: Lookup[]): Promise<MiniPr[]> {
  const found: MiniPr[] = []
  for (let start = 0; start < lookups.length; start += LOOKUPS_PER_QUERY) {
    const chunk = lookups.slice(start, start + LOOKUPS_PER_QUERY)
    // biome-ignore lint/performance/noAwaitInLoops: chunks run one after another to stay under GitHub's rate limits.
    const data = await octokit.graphql<Record<string, { pullRequests: { nodes: (MiniPr | null)[] } } | null>>(
      buildLookupQuery(chunk),
    )
    chunk.forEach((_, index) => {
      for (const pull of data[`l${index}`]?.pullRequests.nodes ?? []) {
        if (pull) {
          found.push(pull)
        }
      }
    })
  }
  return found
}

function buildLookupQuery(chunk: Lookup[]) {
  const parts = chunk.map((lookup, index) => {
    const { owner, repo } = splitRepo(lookup.repo)
    return `l${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
      pullRequests(${lookup.field}: ${JSON.stringify(lookup.ref)}, states: OPEN, first: ${lookup.first}) { nodes { ${MINI} } } }`
  })
  return `query {\n${parts.join('\n')}\n}`
}

/**
 * Finds stacked PRs for the inbox and caches the result: polling every few minutes would otherwise
 * repeat several GraphQL rounds even when nothing changed.
 */
export class StackFinder {
  #cache: { signature: string; at: number; stacks: Stack[] } | null = null

  async stacksForInbox(octokit: Octokit, requested: PullSummary[], reviewed: PullSummary[]): Promise<Stack[]> {
    const all = [...requested, ...reviewed]
    const signature = signInbox(all)
    if (this.#cache && this.#cache.signature === signature && Date.now() - this.#cache.at < STACK_TTL_MS) {
      return withInboxTags(this.#cache.stacks, requested, reviewed)
    }
    try {
      const stacks = await findStacks(
        octokit,
        all.map(summaryToMini),
        tagInbox(requested, reviewed),
        collectStaleIds(all),
      )
      this.#cache = { signature, at: Date.now(), stacks }
      markStackPositions(stacks, all)
      return stacks
    } catch (err) {
      console.error('[revio] stack lookup failed:', errorMessage(err))
      if (!this.#cache) {
        return []
      }
      return withInboxTags(this.#cache.stacks, requested, reviewed)
    }
  }
}

/** The stack a single PR belongs to (it may be outside your inbox), or null when it is not stacked. */
export async function fetchStack(ref: PullRef, inbox: Inbox | null): Promise<Stack | null> {
  const cached = inbox?.stacks.find((st) =>
    st.nodes.some((node) => node.pr.repo === ref.repo && node.pr.number === ref.number),
  )
  if (cached) {
    return cached
  }
  const octokit = await gh()
  const seed = await fetchMiniPr(octokit, ref)
  if (!seed) {
    return null
  }
  const requested = inbox?.requested ?? []
  const stacks = await findStacks(
    octokit,
    [seed],
    tagInbox(requested, inbox?.reviewed ?? []),
    collectStaleIds(requested),
  )
  return stacks[0] ?? null
}
