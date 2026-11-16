export interface ThreadComment {
  author: string
  authorAvatar: string
  /** Comment from a bot account (linters, AI reviewers, CI). */
  bot: boolean
  body: string
  createdAt: string
  url: string
}
/** An unresolved review thread you are part of, on an open PR. */
export interface OpenThread {
  id: string
  repo: string
  number: number
  prTitle: string
  prUrl: string
  prAuthor: string
  isDraft: boolean
  path: string
  /** Line on the new side, or null when the code it was on has changed (outdated). */
  line: number | null
  outdated: boolean
  /** The latest comments, oldest first. */
  comments: ThreadComment[]
  totalComments: number
  /** "you": someone else spoke last. "others": your comment has no answer yet. */
  waitingOn: 'you' | 'others'
  lastActivityAt: string
}
export interface ThreadsInbox {
  threads: OpenThread[]
  fetchedAt: string
}
