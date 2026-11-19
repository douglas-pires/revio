import type { Octokit } from '@octokit/rest'
import type { ReactionContent, ReactionSummary } from '@shared/reaction.types.ts'
import { type RawReactionGroup, toReactionSummaries } from '@shared/reaction.util.ts'

export const REACTION_GROUPS = 'reactionGroups { content viewerHasReacted reactors { totalCount } }'

/** Adds or removes your reaction on a comment (by GraphQL node id) and returns the comment's reactions after. */
export async function setReaction(
  octokit: Octokit,
  subjectId: string,
  content: ReactionContent,
  on: boolean,
): Promise<ReactionSummary[]> {
  let mutation = 'removeReaction'
  if (on) {
    mutation = 'addReaction'
  }
  const data = await octokit.graphql<Record<string, { subject: { reactionGroups: RawReactionGroup[] | null } }>>(
    `mutation ($id: ID!, $content: ReactionContent!) {
      ${mutation}(input: { subjectId: $id, content: $content }) { subject { ${REACTION_GROUPS} } }
    }`,
    { id: subjectId, content },
  )
  return toReactionSummaries(data[mutation]?.subject.reactionGroups ?? [])
}
