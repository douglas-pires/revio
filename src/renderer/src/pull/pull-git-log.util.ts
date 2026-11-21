import type { Commit } from '@shared/git-log.types.ts'
import type { LogFilters } from '../gitlog/log-filters.types.ts'

/** The most of the window the panel may take, so the review above stays usable. */
const MAX_PANEL_SHARE = 0.75

/** The log panel's height until you drag it, and the least it can be. */
export const DEFAULT_PANEL_HEIGHT_PX = 320
export const MIN_PANEL_HEIGHT_PX = 160

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
