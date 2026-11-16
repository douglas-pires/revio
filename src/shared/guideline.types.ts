export interface Guideline {
  id: string
  /** "owner/repo", or "*" for guidelines that apply to every repository. */
  repo: string
  /** Folder inside the repo, e.g. "apps/web/". Empty string = whole repo. */
  path: string
  title: string
  body: string
  enabled: boolean
  updatedAt: string
}
export interface ResolvedGuideline extends Guideline {
  /** Changed files this guideline covers. */
  matchedFiles: number
}
