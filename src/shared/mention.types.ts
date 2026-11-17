/** One comment (or PR description) that mentions you or one of your teams. */
export interface MentionSnippet {
  id: string
  kind: 'description' | 'comment' | 'review' | 'review-comment'
  author: string
  authorAvatar: string
  body: string
  createdAt: string
  url: string
  /** File and line for review comments, so the PR can open there. */
  path: string | null
  line: number | null
  /** The review comment's id, so the PR can open at that comment. */
  commentId: number | null
  /** The team handle that was mentioned (org/slug), or null when you were mentioned by name. */
  viaTeam: string | null
  /** Unread on GitHub: newer than when you last read this PR's notification. */
  isNew: boolean
}
/** A PR with mentions of you in the recent window, newest mention first. */
export interface Mention {
  repo: string
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  /** GitHub notification thread, used to mark it read. */
  notificationId: string | null
  snippets: MentionSnippet[]
  latestAt: string
}
export interface MentionsInbox {
  /** Your login, to find @you in the text. */
  viewer: string
  mentions: Mention[]
  windowDays: number
  fetchedAt: string
  error?: string
}
