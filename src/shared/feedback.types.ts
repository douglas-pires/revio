/** What the feedback is: a bug report or a feature request. */
export type FeedbackKind = 'bug' | 'feature'

/** Basic facts about this Mac and this Revio, added to bug reports so they can be reproduced. */
export interface SystemInfo {
  appVersion: string
  /** "release" for an installed app, "development" when run from source. */
  build: 'release' | 'development'
  /** e.g. "macOS 15.2". */
  os: string
  arch: string
  /** e.g. "Apple M3 Pro". */
  chip: string
  memoryGb: number
  electron: string
  chrome: string
  node: string
  locale: string
}

export interface FeedbackInput {
  kind: FeedbackKind
  title: string
  description: string
  /** Bug reports only: add the system info. */
  includeSystemInfo: boolean
}

/** Where the issue is: created on GitHub, or opened prefilled in the browser for you to submit. */
export interface FeedbackResult {
  url: string
  via: 'created' | 'browser'
}
