import { REACTIONS, type ReactionContent, type ReactionSummary } from './reaction.types.ts'

const ORDER = new Map<string, number>(REACTIONS.map((r, i) => [r.content, i]))

/** Sorts in GitHub's reaction order; unknown kinds go last. */
const byGithubOrder = (a: { content: string }, b: { content: string }) =>
  (ORDER.get(a.content) ?? REACTIONS.length) - (ORDER.get(b.content) ?? REACTIONS.length)

/** GitHub's GraphQL `reactionGroups` entry. */
export interface RawReactionGroup {
  content: string
  viewerHasReacted: boolean
  reactors: { totalCount: number }
}

/** The emojis someone reacted with, in GitHub's order; unknown kinds are dropped. */
export function toReactionSummaries(groups: readonly RawReactionGroup[]): ReactionSummary[] {
  return groups
    .filter((g) => ORDER.has(g.content) && g.reactors.totalCount > 0)
    .sort(byGithubOrder)
    .map((g) => ({
      content: g.content as ReactionContent,
      count: g.reactors.totalCount,
      viewerHasReacted: g.viewerHasReacted,
    }))
}

/** The summaries after you add or remove your reaction, for showing it before GitHub answers. */
export function applyReaction(
  summaries: readonly ReactionSummary[],
  content: ReactionContent,
  on: boolean,
): ReactionSummary[] {
  const current = summaries.find((s) => s.content === content)
  if (Boolean(current?.viewerHasReacted) === on) {
    return [...summaries]
  }
  let change = -1
  if (on) {
    change = 1
  }
  const count = (current?.count ?? 0) + change
  const next = summaries.filter((s) => s.content !== content)
  if (count > 0) {
    next.push({ content, count, viewerHasReacted: on })
  }
  return next.sort(byGithubOrder)
}
