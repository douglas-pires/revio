/** What the last update check found. */
export interface UpdateStatus {
  /** The running version. */
  current: string
  /** The newest released version, once a check succeeded. */
  latest: string | null
  available: boolean
  /** The release page, with its notes and downloads. */
  releaseUrl: string | null
  /** The installer for this Mac, when the release has one. */
  downloadUrl: string | null
  notes: string
  checkedAt: string | null
  checking: boolean
  error: string | null
}
