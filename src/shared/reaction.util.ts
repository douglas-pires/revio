import { REACTIONS, type ReactionContent, type ReactionSummary } from './reaction.types'

/** GitHub's GraphQL `reactionGroups` entry. */
export interface RawReactionGroup {
  content: string
  viewerHasReacted: boolean
  reactors: { totalCount: number }
}

const ORDER = new Map<string, number>(REACTIONS.map((r, i) => [r.content, i]))

/** The emojis someone reacted with, in GitHub's order; unknown kinds are dropped. */
export function toReactionSummaries(groups: readonly RawReactionGroup[]): ReactionSummary[] {
  return groups
    .filter((g) => ORDER.has(g.content) && g.reactors.totalCount > 0)
    .sort((a, b) => ORDER.get(a.content)! - ORDER.get(b.content)!)
    .map((g) => ({ content: g.content as ReactionContent, count: g.reactors.totalCount, viewerHasReacted: g.viewerHasReacted }))
}

/** The summaries after you add or remove your reaction, for showing it before GitHub answers. */
export function applyReaction(summaries: readonly ReactionSummary[], content: ReactionContent, on: boolean): ReactionSummary[] {
  const current = summaries.find((s) => s.content === content)
  if (!!current?.viewerHasReacted === on) return [...summaries]
  const count = (current?.count ?? 0) + (on ? 1 : -1)
  const others = summaries.filter((s) => s.content !== content)
  const next = count > 0 ? [...others, { content, count, viewerHasReacted: on }] : others
  return next.sort((a, b) => ORDER.get(a.content)! - ORDER.get(b.content)!)
}
