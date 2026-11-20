import { errorMessage } from '@shared/error.util.ts'
import type { Stack, StackPrComments } from '@shared/inbox.types.ts'
import { gh, viewerLogin } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { type RawStackThread, summarizeStackPr } from './stack-comments.util.ts'

/** Moving along a stack opens a PR view per step; within this long they share one lookup. */
const FRESH_MS = 30_000
/** A larger stack is cut here, to keep the query inside GitHub's limits. */
const MAX_PRS = 40

type Data = Record<string, { pullRequest: { reviewThreads: { nodes: (RawStackThread | null)[] } } | null } | null>

/** One aliased query for every PR in the stack: each thread's resolution and its comment authors. */
function buildQuery(prs: readonly { repo: string; number: number }[]) {
  const parts = prs.map((pr, k) => {
    const { owner, repo } = splitRepo(pr.repo)
    return `p${k}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
      pullRequest(number: ${pr.number}) {
        reviewThreads(first: 100) { nodes { isResolved comments(first: 50) { nodes { author { login } } } } }
      } }`
  })
  return `query {\n${parts.join('\n')}\n}`
}

async function load(stack: Stack): Promise<StackPrComments[]> {
  const prs = stack.nodes.slice(0, MAX_PRS).map((n) => ({ repo: n.pr.repo, number: n.pr.number }))
  try {
    const [octokit, viewer] = await Promise.all([gh(), viewerLogin()])
    const data = await octokit.graphql<Data>(buildQuery(prs))
    return prs.map((pr, k) => summarizeStackPr(pr, data[`p${k}`]?.pullRequest?.reviewThreads.nodes ?? [], viewer))
  } catch (err) {
    console.error('[revio] stack comments lookup failed:', errorMessage(err))
    return []
  }
}

const recent = new Map<string, { at: number; result: Promise<StackPrComments[]> }>()

/** Where you commented across the stack; empty when GitHub would not say. Shared for a short while per stack. */
export function fetchStackComments(stack: Stack): Promise<StackPrComments[]> {
  const key = stack.nodes.map((n) => `${n.pr.repo}#${n.pr.number}`).join(',')
  const hit = recent.get(key)
  if (hit && Date.now() - hit.at < FRESH_MS) {
    return hit.result
  }
  const result = load(stack)
  recent.set(key, { at: Date.now(), result })
  return result
}
