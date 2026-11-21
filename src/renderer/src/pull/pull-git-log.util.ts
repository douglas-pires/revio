import { looksLikeHash } from '@shared/commit-hash.util.ts'
import type { Commit } from '@shared/git-log.types.ts'
import { matchFuzzy } from '../common/fuzzy-match.util.ts'
import type { LogFilters } from '../gitlog/log-filters.types.ts'

/** The most of the window the panel may take, so the review above stays usable. */
const MAX_PANEL_SHARE = 0.75

/** The log panel's height until you drag it, and the least it can be. */
export const DEFAULT_PANEL_HEIGHT_PX = 320
export const MIN_PANEL_HEIGHT_PX = 160

/** The message search, unless it is a hash (which GitHub looks up instead): '' for none. */
export function readMessageQuery(text: string): string {
  if (looksLikeHash(text)) {
    return ''
  }
  return text.trim()
}

/** The hash to look up on GitHub, when the search is one: '' otherwise. */
export function readHashQuery(text: string): string {
  if (looksLikeHash(text)) {
    return text.trim()
  }
  return ''
}

/** The commits whose subject fuzzily matches the message search, in log order; all of them for none. */
export function filterByMessage(commits: readonly Commit[], messageQuery: string): Commit[] {
  if (!messageQuery) {
    return [...commits]
  }
  return commits.filter((commit) => matchFuzzy(messageQuery, commit.subject) !== null)
}

/** Paths to suggest for the path filter: the PR's files, then the folders that hold them. */
export function listPathSuggestions(paths: readonly string[]): string[] {
  const folders = new Set<string>()
  for (const path of paths) {
    for (let end = path.indexOf('/'); end > 0; end = path.indexOf('/', end + 1)) {
      folders.add(path.slice(0, end))
    }
  }
  return [...new Set(paths), ...[...folders].sort((left, right) => left.localeCompare(right))]
}

/** A dragged height kept between the minimum and three quarters of the window. */
export function clampPanelHeight(height: number, windowHeight: number): number {
  const maxHeight = Math.max(MIN_PANEL_HEIGHT_PX, Math.round(windowHeight * MAX_PANEL_SHARE))
  return Math.min(Math.max(Math.round(height), MIN_PANEL_HEIGHT_PX), maxHeight)
}

/** Whether the filters skip commits in the middle of the history (a path, an author, a message), not just its end. */
export function skipsCommits(filters: LogFilters): boolean {
  return Boolean(filters.path.trim() || filters.author.trim() || filters.text.trim())
}

/**
 * The commits as the graph draws them. GitHub gives each commit its real parents, which a path, author or message
 * filter mostly hides; then each commit is linked to the next one shown, so the history reads as one line instead of
 * a lane per commit. The PR's head commit is labelled with its branch.
 */
export function prepareLogCommits(
  commits: readonly Commit[],
  options: { skipsCommits: boolean; headSha: string; headRef: string },
): Commit[] {
  return commits.map((commit, index) => {
    const prepared = { ...commit }
    if (options.skipsCommits) {
      const next = commits[index + 1]
      prepared.parents = []
      if (next) {
        prepared.parents = [next.hash]
      }
    }
    if (commit.hash === options.headSha) {
      prepared.refs = [options.headRef, ...commit.refs]
    }
    return prepared
  })
}
