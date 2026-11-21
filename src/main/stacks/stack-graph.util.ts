import type { PullSummary, Stack, StackPr } from '@shared/inbox.types.ts'

/** Two chained PRs make a stack; a lone PR is not one. */
const MIN_STACK_SIZE = 2

const toBranchKey = (pr: MiniPr, branch: string) => `${pr.repository.nameWithOwner}|${branch}`

function findParent(nodes: MiniPr[]) {
  const byHead = new Map(nodes.map((node) => [toBranchKey(node, node.headRefName), node]))
  return (pull: MiniPr) => {
    // A PR on the default branch is a stack bottom, even when a fork PR's head branch is also called "main".
    if (pull.baseRefName === pull.repository.defaultBranchRef?.name) {
      return
    }
    const parent = byHead.get(toBranchKey(pull, pull.baseRefName))
    if (parent?.id === pull.id) {
      return
    }
    return parent
  }
}

function groupChildren(nodes: MiniPr[], parentOf: (pull: MiniPr) => MiniPr | undefined) {
  const children = new Map<string, MiniPr[]>()
  for (const node of nodes) {
    const parent = parentOf(node)
    if (parent) {
      children.set(parent.id, [...(children.get(parent.id) ?? []), node])
    }
  }
  for (const list of children.values()) {
    list.sort((left, right) => left.number - right.number)
  }
  return children
}

/** Depth-first from the root, so each PR is followed by the PRs stacked on it. */
function walkDown(root: MiniPr, children: Map<string, MiniPr[]>, seen: Set<string>) {
  const output: { pr: MiniPr; depth: number }[] = []
  const visit = (pr: MiniPr, depth: number) => {
    if (seen.has(pr.id)) {
      return
    }
    seen.add(pr.id)
    output.push({ pr, depth })
    for (const child of children.get(pr.id) ?? []) {
      visit(child, depth + 1)
    }
  }
  visit(root, 0)
  return output
}

function toStackPr(pull: MiniPr, tag: InboxTag, staleIds: Set<string>): StackPr {
  return {
    id: pull.id,
    number: pull.number,
    title: pull.title,
    url: pull.url,
    repo: pull.repository.nameWithOwner,
    author: pull.author?.login ?? 'ghost',
    authorAvatar: pull.author?.avatarUrl ?? '',
    headRef: pull.headRefName,
    baseRef: pull.baseRefName,
    isDraft: pull.isDraft,
    reviewDecision: pull.reviewDecision,
    inbox: tag(pull.id),
    stale: staleIds.has(pull.id),
  }
}

/** The PR fields stack detection needs, in GitHub's GraphQL shape. */
export interface MiniPr {
  id: string
  number: number
  title: string
  url: string
  isDraft: boolean
  headRefName: string
  baseRefName: string
  reviewDecision: string | null
  author: { login: string; avatarUrl: string } | null
  repository: { nameWithOwner: string; defaultBranchRef: { name: string } | null }
}

/** Says where a PR sits in your inbox. */
export type InboxTag = (id: string) => StackPr['inbox']

export function convertSummaryToMini(summary: PullSummary): MiniPr {
  return {
    id: summary.id,
    number: summary.number,
    title: summary.title,
    url: summary.url,
    isDraft: summary.isDraft,
    headRefName: summary.headRef,
    baseRefName: summary.baseRef,
    reviewDecision: summary.reviewDecision,
    author: { login: summary.author, avatarUrl: summary.authorAvatar },
    repository: { nameWithOwner: summary.repo, defaultBranchRef: { name: summary.defaultBranch } },
  }
}

export function tagInbox(requested: readonly { id: string }[], reviewed: readonly { id: string }[]): InboxTag {
  const requestedIds = new Set(requested.map((pull) => pull.id))
  const reviewedIds = new Set(reviewed.map((pull) => pull.id))
  return (id) => {
    if (requestedIds.has(id)) {
      return 'requested'
    }
    if (reviewedIds.has(id)) {
      return 'reviewed'
    }
    return null
  }
}

/**
 * Groups open PRs into stacks. A PR's parent is the open PR whose head branch is its base branch, in the
 * same repository. Keeps stacks of two or more that contain at least one seed, ordered bottom-up.
 */
export function buildStacks(
  prs: Iterable<MiniPr>,
  seedIds: Set<string>,
  tag: InboxTag,
  staleIds: Set<string>,
): Stack[] {
  const nodes = [...prs]
  const parentOf = findParent(nodes)
  const children = groupChildren(nodes, parentOf)
  const seen = new Set<string>()
  const stacks: Stack[] = []
  for (const root of nodes.filter((node) => !(parentOf(node) || seen.has(node.id)))) {
    const members = walkDown(root, children, seen)
    if (members.length >= MIN_STACK_SIZE && members.some(({ pr }) => seedIds.has(pr.id))) {
      stacks.push({
        id: `${root.repository.nameWithOwner}#${root.number}`,
        repo: root.repository.nameWithOwner,
        base: root.baseRefName,
        nodes: members.map(({ pr, depth }) => ({ pr: toStackPr(pr, tag, staleIds), depth })),
      })
    }
  }
  return stacks
}

/** Refreshes inbox tags and staleness on stacks found earlier, and re-marks positions on the summaries. */
export function applyInboxTags(stacks: Stack[], requested: PullSummary[], reviewed: PullSummary[]): Stack[] {
  const tag = tagInbox(requested, reviewed)
  const stale = new Set(requested.filter((pull) => pull.stale).map((pull) => pull.id))
  const fresh = stacks.map((stack) => ({
    ...stack,
    nodes: stack.nodes.map((node) => ({
      ...node,
      pr: { ...node.pr, inbox: tag(node.pr.id), stale: stale.has(node.pr.id) },
    })),
  }))
  markStackPositions(fresh, [...requested, ...reviewed])
  return fresh
}

/** Sets `stack` (1-based position from the bottom) on each summary that belongs to a stack. Mutates `prs`. */
export function markStackPositions(stacks: Stack[], prs: PullSummary[]) {
  for (const stack of stacks) {
    const order = stack.nodes.map((node) => node.pr.id)
    for (const pull of prs) {
      const position = order.indexOf(pull.id)
      if (position >= 0) {
        pull.stack = { id: stack.id, position: position + 1, size: order.length }
      }
    }
  }
}
