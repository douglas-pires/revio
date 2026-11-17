/** GitHub's reaction set, in the order GitHub shows them. */
export const REACTIONS = [
  { content: 'THUMBS_UP', emoji: '👍', label: 'Thumbs up' },
  { content: 'THUMBS_DOWN', emoji: '👎', label: 'Thumbs down' },
  { content: 'LAUGH', emoji: '😄', label: 'Laugh' },
  { content: 'HOORAY', emoji: '🎉', label: 'Hooray' },
  { content: 'CONFUSED', emoji: '😕', label: 'Confused' },
  { content: 'HEART', emoji: '❤️', label: 'Heart' },
  { content: 'ROCKET', emoji: '🚀', label: 'Rocket' },
  { content: 'EYES', emoji: '👀', label: 'Eyes' },
] as const

export type ReactionContent = (typeof REACTIONS)[number]['content']

/** One emoji's reactions on a comment. Only emojis with at least one reaction are listed. */
export interface ReactionSummary {
  content: ReactionContent
  count: number
  viewerHasReacted: boolean
}
