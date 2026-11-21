/** What a PR's git log shows: the history GitHub has from the PR's head, and the filters on it. */
export interface PullLogQuery {
  /** The commit the history starts from: the PR's head. */
  sha: string
  /** A commit hash (or its start) to find; '' to list the history. Messages are matched in Revio, not on GitHub. */
  hash: string
  /** GitHub login or email of the author; '' for anyone. */
  author: string
  /** Only commits after this many days ago; 0 for any time. */
  sinceDays: number
  /** Only commits touching this path; '' for all. */
  path: string
  /** The page to read, from 1. */
  page: number
}

export interface Commit {
  hash: string
  parents: string[]
  author: string
  authorEmail: string
  /** ISO date the commit was authored. */
  date: string
  subject: string
  /** Labels to show on it, such as the PR's branch on its head commit. */
  refs: string[]
}

/** One page of the log, newest first. */
export interface LogPage {
  commits: Commit[]
  /** Whether there are more commits after this page. */
  more: boolean
}

export type FileChangeStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T'

export interface FileChange {
  status: FileChangeStatus
  path: string
  /** The path before a rename or copy. */
  from?: string | undefined
}

export interface CommitDetail {
  hash: string
  /** The full message. */
  message: string
  author: string
  authorEmail: string
  date: string
  committer: string
  /** Changed files, as GitHub lists them (up to 300). */
  files: FileChange[]
}

/** A commit's CI result on GitHub, from its status checks. */
export type CiState = 'success' | 'failure' | 'pending' | 'none'

/** One GitHub check on a commit: a check run (GitHub Actions and the like) or a commit status from other CI. */
export interface CommitCheck {
  name: string
  state: CiState
  /** Where the check's details are, when GitHub gives a link. */
  url: string | null
}

/** A check context as GitHub's GraphQL `statusCheckRollup.contexts` returns it. */
export type RawCheckContext =
  | { __typename: 'CheckRun'; name: string; status: string; conclusion: string | null; detailsUrl: string | null }
  | { __typename: 'StatusContext'; context: string; state: string; targetUrl: string | null }
