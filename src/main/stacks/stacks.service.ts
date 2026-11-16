import type { Octokit } from '@octokit/rest'
import type { Inbox, PullRef, PullSummary, Stack } from '@shared/types'
import { gh } from '../github/github.client'
import { splitRepo } from '../github/repo-name.util'
import { buildStacks, markStackPositions, summaryToMini, tagInbox, withInboxTags, type InboxTag, type MiniPr } from './stack-graph.util'

/** Stacks are re-walked at most this often while the inbox's PRs and branches stay the same. */
const STACK_TTL_MS = 15 * 60_000
/** How many rounds of branch links to follow up and down from the seeds. */
const MAX_ROUNDS = 5
/** Aliased lookups batched into one GraphQL query. */
const LOOKUPS_PER_QUERY = 40

const MINI = `id number title url isDraft headRefName baseRefName reviewDecision
  author { login avatarUrl(size: 64) } repository { nameWithOwner defaultBranchRef { name } }`

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
      const stacks = await findStacks(octokit, all.map(summaryToMini), tagInbox(requested, reviewed), collectStaleIds(all))
      this.#cache = { signature, at: Date.now(), stacks }
      markStackPositions(stacks, all)
      return stacks
    } catch (err) {
      console.error('[revio] stack lookup failed:', err instanceof Error ? err.message : err)
      return this.#cache ? withInboxTags(this.#cache.stacks, requested, reviewed) : []
    }
  }
}

/** Changes whenever a PR joins or leaves the inbox, moves branches, or changes review decision. */
const signInbox = (prs: PullSummary[]) =>
  prs
    .map((p) => `${p.id}:${p.headRef}:${p.baseRef}:${p.reviewDecision}`)
    .sort()
    .join('|')

const collectStaleIds = (prs: PullSummary[]) => new Set(prs.filter((p) => p.stale).map((p) => p.id))

/** The stack a single PR belongs to (it may be outside your inbox), or null when it is not stacked. */
export async function fetchStack(ref: PullRef, inbox: Inbox | null): Promise<Stack | null> {
  const cached = inbox?.stacks.find((st) => st.nodes.some((n) => n.pr.repo === ref.repo && n.pr.number === ref.number))
  if (cached) return cached
  const octokit = await gh()
  const seed = await fetchMiniPr(octokit, ref)
  if (!seed) return null
  const requested = inbox?.requested ?? []
  const stacks = await findStacks(octokit, [seed], tagInbox(requested, inbox?.reviewed ?? []), collectStaleIds(requested))
  return stacks[0] ?? null
}

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
  return buildStacks(prs.values(), new Set(seeds.map((s) => s.id)), tag, staleIds)
}

/** Follows branch links up (the PR my base branch belongs to) and down (PRs based on my head branch). */
async function collectLinkedPrs(octokit: Octokit, seeds: MiniPr[]): Promise<Map<string, MiniPr>> {
  const prs = new Map(seeds.map((n) => [n.id, n]))
  const asked = new Set<string>()
  let frontier = seeds
  for (let round = 0; round < MAX_ROUNDS && frontier.length; round++) {
    const found = await runLookups(octokit, planLookups(frontier, asked))
    frontier = []
    for (const n of found) {
      if (prs.has(n.id)) continue
      prs.set(n.id, n)
      frontier.push(n)
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
    if (asked.has(key)) return
    asked.add(key)
    lookups.push(lookup)
  }
  for (const n of frontier) {
    const repo = n.repository.nameWithOwner
    const defaultBranch = n.repository.defaultBranchRef?.name
    if (n.baseRefName !== defaultBranch) add({ repo, field: 'headRefName', ref: n.baseRefName, first: 1 })
    if (n.headRefName !== defaultBranch) add({ repo, field: 'baseRefName', ref: n.headRefName, first: 10 })
  }
  return lookups
}

async function runLookups(octokit: Octokit, lookups: Lookup[]): Promise<MiniPr[]> {
  const found: MiniPr[] = []
  for (let i = 0; i < lookups.length; i += LOOKUPS_PER_QUERY) {
    const chunk = lookups.slice(i, i + LOOKUPS_PER_QUERY)
    const data = await octokit.graphql<Record<string, { pullRequests: { nodes: (MiniPr | null)[] } } | null>>(buildLookupQuery(chunk))
    chunk.forEach((_, k) => {
      for (const n of data[`l${k}`]?.pullRequests.nodes ?? []) if (n) found.push(n)
    })
  }
  return found
}

function buildLookupQuery(chunk: Lookup[]) {
  const parts = chunk.map((l, k) => {
    const { owner, repo } = splitRepo(l.repo)
    return `l${k}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
      pullRequests(${l.field}: ${JSON.stringify(l.ref)}, states: OPEN, first: ${l.first}) { nodes { ${MINI} } } }`
  })
  return `query {\n${parts.join('\n')}\n}`
}
