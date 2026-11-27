/** How a file relates to the code around it, before you judge its changes. */
export interface FileExplanation {
  /** What the code is for, in plain words. */
  purpose: string
  /** How it works: its main parts and the flow through them (markdown). */
  howItWorks: string
  /** Files it is tied to, and how: calls, is called by, configures, tests. */
  connections: { path: string; relation: string }[]
  /** What this PR changes in it, and why, as far as the PR says. */
  change: string
  /** What to check, given how the code works. */
  watchFor: string[]
}
export interface FileExplanationRecord {
  /** The PR's head when it was written; a newer push may have changed the file. */
  headSha: string
  createdAt: string
  model: string
  explanation: FileExplanation
}
