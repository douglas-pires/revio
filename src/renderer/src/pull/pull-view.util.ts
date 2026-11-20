import type { AskThread } from '@shared/claude.types.ts'
import type { DiffSide, DraftComment } from '@shared/pull.types.ts'
import { type ConversationQuote, isConversationTarget, type PullTarget } from '../common/navigation.types.ts'
import type { ScrollTarget } from './use-scroll-to-target.hook.ts'

const AI_MARK = '🤖'

/**
 * A comment Claude wrote, starting with 🤖 so whoever reads it on GitHub can tell. Marked once, however often it is
 * passed through.
 */
export function markedAsAi(body: string): string {
  if (body.startsWith(AI_MARK)) {
    return body
  }
  return `${AI_MARK} ${body}`
}

/** The conversation comment to quote on the overview when the PR opened at one. */
export function quoteOf(target: PullTarget | undefined): ConversationQuote | null {
  if (!(target && isConversationTarget(target))) {
    return null
  }
  return target.conversation
}

/** The place in the diff the PR opened at, if any. */
export function fileTargetOf(target: PullTarget | undefined): ScrollTarget | undefined {
  if (!target || isConversationTarget(target)) {
    return undefined
  }
  return target
}

/** The review comment whose reply box should open on arrival, when the PR opened to reply. */
export function replyIdOf(target: ScrollTarget | undefined): number | null {
  if (!target?.reply) {
    return null
  }
  return target.commentId ?? null
}

/** The review summary with one more bullet. */
export function withSummaryLine(body: string, line: string) {
  if (!body) {
    return `- ${line}`
  }
  return `${body}\n- ${line}`
}

/** A line to scroll to; only new-side lines can be found in the diff, so others land on the file. */
export function newSideOnly(side: DiffSide, line: number | null) {
  if (side !== 'RIGHT') {
    return null
  }
  return line
}

/** A draft comment from a Claude conversation about lines start..end, marked as Claude's. */
export function draftFromAsk(t: AskThread, body: string): Omit<DraftComment, 'id'> {
  const draft: Omit<DraftComment, 'id'> = { path: t.path, side: t.side, line: t.endLine, body: markedAsAi(body) }
  if (t.startLine !== t.endLine) {
    draft.startLine = t.startLine
  }
  return draft
}

/** The conversations to list: the open one first while it is still unsaved (nothing asked yet), then the saved ones. */
export function askHistory(current: AskThread, saved: readonly AskThread[]): AskThread[] {
  if (current.messages.length > 0) {
    return [...saved]
  }
  return [current, ...saved]
}

/** The other of two states, for a toggle. */
export function toggled<T>(value: T, [first, second]: readonly [T, T]): T {
  if (value === first) {
    return second
  }
  return first
}
