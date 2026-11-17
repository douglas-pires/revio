import type { Octokit } from '@octokit/rest'
import type { ReactionContent, ReactionSummary } from '@shared/reaction.types'
import { toReactionSummaries, type RawReactionGroup } from '@shared/reaction.util'

export const REACTION_GROUPS = 'reactionGroups { content viewerHasReacted reactors { totalCount } }'

/** Adds or removes your reaction on a comment (by GraphQL node id) and returns the comment's reactions after. */
export async function setReaction(octokit: Octokit, subjectId: string, content: ReactionContent, on: boolean): Promise<ReactionSummary[]> {
  const mutation = on ? 'addReaction' : 'removeReaction'
  const data = await octokit.graphql<Record<string, { subject: { reactionGroups: RawReactionGroup[] | null } }>>(
    `mutation ($id: ID!, $content: ReactionContent!) {
      ${mutation}(input: { subjectId: $id, content: $content }) { subject { ${REACTION_GROUPS} } }
    }`,
    { id: subjectId, content },
  )
  return toReactionSummaries(data[mutation]?.subject.reactionGroups ?? [])
}
