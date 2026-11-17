import type { MentionSnippet } from '@shared/mention.types'
import type { PullRef } from '@shared/pull.types'
import type { ScrollTarget } from '../pull/use-scroll-to-target.hook'

/** A comment outside the diff (PR description, conversation comment or review summary) to show on the overview. */
export type ConversationQuote = Pick<MentionSnippet, 'kind' | 'author' | 'authorAvatar' | 'body' | 'url' | 'createdAt'>

/** Where to land in a PR: a file, line or review comment in the diff, or a comment from the conversation. */
export type PullTarget = ScrollTarget | { conversation: ConversationQuote }

export const isConversationTarget = (t: PullTarget): t is { conversation: ConversationQuote } => 'conversation' in t

/** Opens a PR, optionally at a target. */
export type OpenPull = (pull: PullRef, target?: PullTarget) => void
