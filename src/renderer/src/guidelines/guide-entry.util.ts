import type { GuideEntry } from '@shared/review-history.types.ts'

const SUGGESTION_BLOCKS = /```suggestion[\s\S]*?```/gu
const LAST_SLASH = /\/[^/]*$/u

/** A guide a comment's point can go in: where it applies, and how that reads. */
export interface GuideScope {
  repo: string
  path: string
  label: string
}

/** A comment as a guide entry: without its suggested code, which only fits the one line it was on. */
export function buildEntryText(comment: string): string {
  return comment.replaceAll(SUGGESTION_BLOCKS, '').trim()
}

/** The guides a comment on `filePath` could go in: its folder (when it has one), its repository, every repository. */
export function listGuideScopes(repo: string, filePath: string): GuideScope[] {
  const scopes: GuideScope[] = []
  if (filePath.includes('/')) {
    const folder = `${filePath.replace(LAST_SLASH, '')}/`
    scopes.push({ repo, path: folder, label: `${repo} › ${folder}` })
  }
  scopes.push({ repo, path: '', label: repo }, { repo: '*', path: '', label: 'All repositories' })
  return scopes
}

/** The entry to save: the scope picked and the text as edited. */
export const buildGuideEntry = (scope: GuideScope, text: string): GuideEntry => ({
  repo: scope.repo,
  path: scope.path,
  text: text.trim(),
})
