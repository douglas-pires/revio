/** An editor Revio can open files in. */
export interface EditorInfo {
  id: string
  name: string
}

/** A file of a PR's repository, opened from your local clone. */
export interface EditorTarget {
  /** "owner/name" */
  repo: string
  /** Path inside the repository. */
  path: string
  line?: number
}
