/** A GitHub repository with a clone on this Mac, which the log reads with git. */
export interface LocalRepo {
  /** `owner/name`, lowercased. */
  repo: string
  path: string
}

export type BranchKind = 'local' | 'remote'

export interface Branch {
  /** Short name: `main`, `douglas/fix-x`, `origin/main`. */
  name: string
  kind: BranchKind
  /** Whether it is checked out (HEAD). */
  current: boolean
  /** Commits ahead of and behind its upstream, for local branches that track one. */
  ahead: number
  behind: number
}

export interface Branches {
  /** The branch checked out, or null on a detached HEAD. */
  head: string | null
  branches: Branch[]
}

/** What the log shows: all branches or one, and the filters on top. Empty strings mean no filter. */
export interface LogQuery {
  /** Branch name, or '' for every branch. */
  branch: string
  /** Text in the commit message, or the start of a commit hash. */
  text: string
  /** Author name or email. */
  author: string
  /** Only commits after this many days ago; 0 for any time. */
  sinceDays: number
  /** Only commits touching this path. */
  path: string
  /** Commits already loaded, to load the next page after them. */
  skip: number
}

export interface Commit {
  hash: string
  parents: string[]
  author: string
  authorEmail: string
  /** ISO date the commit was authored. */
  date: string
  subject: string
  /** Branch and tag names pointing at it, as `git log --decorate` shows them. */
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
  /** Changed files; for a merge, against its first parent. */
  files: FileChange[]
}

/** A commit's CI result on GitHub, from its status checks. */
export type CiState = 'success' | 'failure' | 'pending' | 'none'
