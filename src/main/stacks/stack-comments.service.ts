import { errorMessage } from '@shared/error.util.ts'
import type { Stack, StackPrComments } from '@shared/inbox.types.ts'
import { type PullRef, pullKey } from '@shared/pull.types.ts'
import { gh, viewerLogin } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { type RawStackThread, summarizeYourThreads } from './stack-comments.util.ts'

/** Moving along a stack opens a PR view per step; within this long they share one lookup. */
const SHARED_LOOKUP_MS = 30_000
/** A larger stack is cut here, to keep the query inside GitHub's limits. */
const MAX_PULLS = 40

/** The threads of each PR, under the alias `p<index>` it was asked for with. */
type StackThreadsResponse = Record<
  string,
  { pullRequest: { reviewThreads: { nodes: (RawStackThread | null)[] } } | null } | null
>

/** One aliased query for every PR in the stack: each thread's resolution and its comment authors. */
function buildStackThreadsQuery(pulls: readonly PullRef[]) {
  const pullQueries = pulls.map((pull, index) => {
    const { owner, repo } = splitRepo(pull.repo)
    return `p${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
      pullRequest(number: ${pull.number}) {
        reviewThreads(first: 100) { nodes { isResolved comments(first: 50) { nodes { author { login } } } } }
      } }`
  })
  return `query {\n${pullQueries.join('\n')}\n}`
}

async function loadStackComments(stack: Stack): Promise<StackPrComments[]> {
  const pulls = stack.nodes.slice(0, MAX_PULLS).map((node) => ({ repo: node.pr.repo, number: node.pr.number }))
  try {
    const [octokit, viewer] = await Promise.all([gh(), viewerLogin()])
    const response = await octokit.graphql<StackThreadsResponse>(buildStackThreadsQuery(pulls))
    return pulls.map((pull, index) =>
      summarizeYourThreads(pull, response[`p${index}`]?.pullRequest?.reviewThreads.nodes ?? [], viewer),
    )
  } catch (err) {
    console.error('[revio] stack comments lookup failed:', errorMessage(err))
    return []
  }
}

/** Lookups started in the last `SHARED_LOOKUP_MS`, by the stack's PRs. */
const recentLookups = new Map<string, { startedAt: number; result: Promise<StackPrComments[]> }>()

/** Where you commented across the stack; empty when GitHub would not say. Shared for a short while per stack. */
export function fetchStackComments(stack: Stack): Promise<StackPrComments[]> {
  const stackKey = stack.nodes.map((node) => pullKey(node.pr)).join(',')
  const recentLookup = recentLookups.get(stackKey)
  if (recentLookup && Date.now() - recentLookup.startedAt < SHARED_LOOKUP_MS) {
    return recentLookup.result
  }
  const result = loadStackComments(stack)
  recentLookups.set(stackKey, { startedAt: Date.now(), result })
  return result
}
