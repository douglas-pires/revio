import type { PullSummary, Stack, StackPr } from '@shared/inbox.types.ts'

/** Two chained PRs make a stack; a lone PR is not one. */
const MIN_STACK_SIZE = 2

const toBranchKey = (pr: MiniPr, branch: string) => `${pr.repository.nameWithOwner}|${branch}`

function findParent(nodes: MiniPr[]) {
  const byHead = new Map(nodes.map((n) => [toBranchKey(n, n.headRefName), n]))
  return (n: MiniPr) => {
    // A PR on the default branch is a stack bottom, even when a fork PR's head branch is also called "main".
    if (n.baseRefName === n.repository.defaultBranchRef?.name) {
      return
    }
    const parent = byHead.get(toBranchKey(n, n.baseRefName))
    if (parent?.id === n.id) {
      return
    }
    return parent
  }
}

function groupChildren(nodes: MiniPr[], parentOf: (n: MiniPr) => MiniPr | undefined) {
  const children = new Map<string, MiniPr[]>()
  for (const n of nodes) {
    const parent = parentOf(n)
    if (parent) {
      children.set(parent.id, [...(children.get(parent.id) ?? []), n])
    }
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.number - b.number)
  }
  return children
}

/** Depth-first from the root, so each PR is followed by the PRs stacked on it. */
function walkDown(root: MiniPr, children: Map<string, MiniPr[]>, seen: Set<string>) {
  const out: { pr: MiniPr; depth: number }[] = []
  const visit = (pr: MiniPr, depth: number) => {
    if (seen.has(pr.id)) {
      return
    }
    seen.add(pr.id)
    out.push({ pr, depth })
    for (const child of children.get(pr.id) ?? []) {
      visit(child, depth + 1)
    }
  }
  visit(root, 0)
  return out
}

function toStackPr(n: MiniPr, tag: InboxTag, staleIds: Set<string>): StackPr {
  return {
    id: n.id,
    number: n.number,
    title: n.title,
    url: n.url,
    repo: n.repository.nameWithOwner,
    author: n.author?.login ?? 'ghost',
    authorAvatar: n.author?.avatarUrl ?? '',
    headRef: n.headRefName,
    baseRef: n.baseRefName,
    isDraft: n.isDraft,
    reviewDecision: n.reviewDecision,
    inbox: tag(n.id),
    stale: staleIds.has(n.id),
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

export function summaryToMini(p: PullSummary): MiniPr {
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    url: p.url,
    isDraft: p.isDraft,
    headRefName: p.headRef,
    baseRefName: p.baseRef,
    reviewDecision: p.reviewDecision,
    author: { login: p.author, avatarUrl: p.authorAvatar },
    repository: { nameWithOwner: p.repo, defaultBranchRef: { name: p.defaultBranch } },
  }
}

export function tagInbox(requested: readonly { id: string }[], reviewed: readonly { id: string }[]): InboxTag {
  const req = new Set(requested.map((p) => p.id))
  const rev = new Set(reviewed.map((p) => p.id))
  return (id) => {
    if (req.has(id)) {
      return 'requested'
    }
    if (rev.has(id)) {
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
  for (const root of nodes.filter((n) => !(parentOf(n) || seen.has(n.id)))) {
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
export function withInboxTags(stacks: Stack[], requested: PullSummary[], reviewed: PullSummary[]): Stack[] {
  const tag = tagInbox(requested, reviewed)
  const stale = new Set(requested.filter((p) => p.stale).map((p) => p.id))
  const fresh = stacks.map((st) => ({
    ...st,
    nodes: st.nodes.map((n) => ({ ...n, pr: { ...n.pr, inbox: tag(n.pr.id), stale: stale.has(n.pr.id) } })),
  }))
  markStackPositions(fresh, [...requested, ...reviewed])
  return fresh
}

/** Sets `stack` (1-based position from the bottom) on each summary that belongs to a stack. Mutates `prs`. */
export function markStackPositions(stacks: Stack[], prs: PullSummary[]) {
  for (const st of stacks) {
    const order = st.nodes.map((n) => n.pr.id)
    for (const p of prs) {
      const i = order.indexOf(p.id)
      if (i >= 0) {
        p.stack = { id: st.id, position: i + 1, size: order.length }
      }
    }
  }
}
