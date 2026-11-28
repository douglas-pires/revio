/** Whose work the stats cover: yours, the members' of the teams picked, or everyone's in a repository. */
export type StatsScope = { kind: 'me' } | { kind: 'team'; teams: StatsTeam[] } | { kind: 'repo'; repo: string }

/** How many days back the stats look. */
export const STATS_PERIODS = [30, 90, 180] as const
export type StatsPeriod = (typeof STATS_PERIODS)[number]

/** A team you are in, to pick for the stats. */
export interface StatsTeam {
  org: string
  slug: string
  name: string
}

/** The teams you are in; `error` says why none could be read (the token cannot read organisations, say). */
export interface StatsTeams {
  teams: StatsTeam[]
  error: string | null
}

/** A review on a PR. */
export interface StatsReview {
  reviewer: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  submittedAt: string
  comments: number
}

/** A review asked of someone, or of a team ("@org/slug"). */
export interface StatsRequest {
  reviewer: string
  at: string
}

/** A PR with what the stats are computed from. */
export interface StatsPull {
  repo: string
  number: number
  title: string
  url: string
  author: string
  createdAt: string
  /** When it was opened for review: its last move out of draft, or when it was opened. */
  readyAt: string
  /** The first commit's author date; null when GitHub has none. */
  firstCommitAt: string | null
  mergedAt: string | null
  closedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
  requests: StatsRequest[]
  reviews: StatsReview[]
}

/** The PRs behind the stats of a scope and period. */
export interface StatsData {
  scope: StatsScope
  days: StatsPeriod
  viewer: string
  /** Whose work counts: you, the team's members; null for everyone in the repository. */
  people: string[] | null
  pulls: StatsPull[]
  /** GitHub search stops at 1,000 PRs; true when some were left out. */
  truncated: boolean
  fetchedAt: string
}
