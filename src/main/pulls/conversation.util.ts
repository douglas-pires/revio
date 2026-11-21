import type { ConversationComment } from '@shared/pull.types.ts'

/** A review with a written summary, submitted (pending reviews are yours alone and not in the conversation). */
function hasSummary(review: RawReviewSummary) {
  return review.state !== 'PENDING' && Boolean(review.body?.trim()) && Boolean(review.submitted_at)
}

function convertIssueComment(comment: RawIssueComment, readAvatar: (url?: string) => string): ConversationComment {
  return {
    id: `comment-${comment.id}`,
    kind: 'comment',
    author: comment.user?.login ?? 'ghost',
    authorAvatar: readAvatar(comment.user?.avatar_url),
    body: comment.body ?? '',
    url: comment.html_url,
    createdAt: comment.created_at,
  }
}

function convertReviewSummary(review: RawReviewSummary, readAvatar: (url?: string) => string): ConversationComment {
  return {
    id: `review-${review.id}`,
    kind: 'review',
    author: review.user?.login ?? 'ghost',
    authorAvatar: readAvatar(review.user?.avatar_url),
    body: review.body ?? '',
    url: review.html_url,
    createdAt: review.submitted_at ?? '',
  }
}

/** What the REST API gives for a conversation comment (`issues.listComments`), as far as Revio reads it. */
export interface RawIssueComment {
  id: number
  body?: string | undefined
  html_url: string
  created_at: string
  user?: { login: string; avatar_url?: string | undefined } | null
}

/** What the REST API gives for a review (`pulls.listReviews`), as far as the conversation reads it. */
export interface RawReviewSummary {
  id: number
  body?: string | null | undefined
  html_url: string
  submitted_at?: string | undefined
  state: string
  user?: { login: string; avatar_url?: string | undefined } | null
}

/**
 * The PR's conversation as GitHub's Conversation tab lists it, oldest first: plain comments and the written
 * summaries of submitted reviews. `readAvatar` turns an avatar URL into the size Revio shows.
 */
export function buildConversation(
  comments: readonly RawIssueComment[],
  reviews: readonly RawReviewSummary[],
  readAvatar: (url?: string) => string,
): ConversationComment[] {
  return [
    ...comments.map((comment) => convertIssueComment(comment, readAvatar)),
    ...reviews.filter(hasSummary).map((review) => convertReviewSummary(review, readAvatar)),
  ].sort((earlier, later) => earlier.createdAt.localeCompare(later.createdAt))
}
