import type { Branch } from '@shared/git-log.types.ts'

/** The most of the window the panel may take, so the review above stays usable. */
const MAX_PANEL_SHARE = 0.75

/** The log panel's height until you drag it, and the least it can be. */
export const DEFAULT_PANEL_HEIGHT_PX = 320
export const MIN_PANEL_HEIGHT_PX = 160

/**
 * The branch the PR's log starts on: the PR's branch as last fetched (`origin/<head>`), else a local branch of that
 * name, else every branch ('') when the clone has neither.
 */
export function pickPullBranch(branches: readonly Branch[], headRef: string): string {
  const remoteName = `origin/${headRef}`
  if (branches.some((branch) => branch.kind === 'remote' && branch.name === remoteName)) {
    return remoteName
  }
  if (branches.some((branch) => branch.kind === 'local' && branch.name === headRef)) {
    return headRef
  }
  return ''
}

/** A dragged height kept between the minimum and three quarters of the window. */
export function clampPanelHeight(height: number, windowHeight: number): number {
  const maxHeight = Math.max(MIN_PANEL_HEIGHT_PX, Math.round(windowHeight * MAX_PANEL_SHARE))
  return Math.min(Math.max(Math.round(height), MIN_PANEL_HEIGHT_PX), maxHeight)
}
