/** A commit as the history views show it. */
export interface CommitSummary {
  sha: string
  shortSha: string
  /** First line of the message. */
  headline: string
  /** GitHub login when the author is linked to an account, else the git author name. */
  author: string
  authorAvatar: string
  date: string
  url: string
}

/** Lines start..end (1-based, inclusive, at the commit blamed) were last changed by `commit`. */
export interface BlameRange {
  start: number
  end: number
  commit: CommitSummary
}

/** A commit that changed a file, newest first. */
export interface FileHistoryEntry extends CommitSummary {
  /** One of this PR's own commits. */
  inThisPr: boolean
}

/** Which file of which PR, at which commit. */
export interface FileAtCommit {
  repo: string
  sha: string
  path: string
}

/** One of the PR's commits, with its full message. */
export interface PullCommit extends CommitSummary {
  message: string
}

/** A file a commit changed. */
export interface CommitFile {
  path: string
  previousPath?: string
  status: string
  additions: number
  deletions: number
  /** Unified diff; missing for binary or very large changes. */
  patch?: string
}

/** A commit in a repository. */
export interface CommitRef {
  repo: string
  sha: string
}
