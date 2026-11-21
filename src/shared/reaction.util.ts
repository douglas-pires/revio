import { REACTIONS, type ReactionContent, type ReactionSummary } from './reaction.types.ts'

const ORDER = new Map<string, number>(REACTIONS.map((reaction, index) => [reaction.content, index]))

/** Sorts in GitHub's reaction order; unknown kinds go last. */
const byGithubOrder = (left: { content: string }, right: { content: string }) =>
  (ORDER.get(left.content) ?? REACTIONS.length) - (ORDER.get(right.content) ?? REACTIONS.length)

/** GitHub's GraphQL `reactionGroups` entry. */
export interface RawReactionGroup {
  content: string
  viewerHasReacted: boolean
  reactors: { totalCount: number }
}

/** The emojis someone reacted with, in GitHub's order; unknown kinds are dropped. */
export function toReactionSummaries(groups: readonly RawReactionGroup[]): ReactionSummary[] {
  return groups
    .filter((group) => ORDER.has(group.content) && group.reactors.totalCount > 0)
    .sort(byGithubOrder)
    .map((group) => ({
      content: group.content as ReactionContent,
      count: group.reactors.totalCount,
      viewerHasReacted: group.viewerHasReacted,
    }))
}

/** The summaries after you add or remove your reaction, for showing it before GitHub answers. */
export function applyReaction(
  summaries: readonly ReactionSummary[],
  content: ReactionContent,
  on: boolean,
): ReactionSummary[] {
  const current = summaries.find((summary) => summary.content === content)
  if (Boolean(current?.viewerHasReacted) === on) {
    return [...summaries]
  }
  let change = -1
  if (on) {
    change = 1
  }
  const count = (current?.count ?? 0) + change
  const next = summaries.filter((summary) => summary.content !== content)
  if (count > 0) {
    next.push({ content, count, viewerHasReacted: on })
  }
  return next.sort(byGithubOrder)
}
