/** One change of a release, from its Conventional Commits line. */
export interface ReleaseChange {
  text: string
  /** The area it is about, when the line names one. */
  scope: string | null
  /** It changes how something worked. */
  breaking: boolean
}

/** What a release brought, sorted by what it means to someone using Revio. */
export interface ReleaseNotes {
  version: string
  publishedAt: string
  url: string
  /** Markdown written above or between the changes by hand; '' for none. */
  introduction: string
  features: ReleaseChange[]
  fixes: ReleaseChange[]
  /** Changes nobody using Revio notices, and lines that say nothing about their kind. */
  others: ReleaseChange[]
}

/** Revio was updated since you last used it. */
export interface UnseenUpdate {
  /** The release used before; null when it is not known. */
  previous: string | null
}
