import type { PullDetail } from '@shared/pull.types.ts'
import type { PaletteAction, PalettePage } from '../palette/palette.types.ts'
import { buildShortcutEntries } from '../palette/shortcut-entries.util.ts'
import { usePalettePage } from '../palette/use-palette-page.hook.ts'
import { listPullTabs, type PullTab } from './pull-tabs.util.ts'
import { toggleBetween } from './pull-view.util.ts'
import { BLAME_STATES, DIFF_VIEWS, PANEL_STATES, type PullViewState } from './use-pull-view.hook.ts'

/** The other tabs to go to. */
function listTabActions(view: PullViewState): PaletteAction[] {
  return listPullTabs(undefined)
    .filter(({ value }) => value !== view.tab)
    .map(({ value, label }) => ({ id: `tab-${value}`, label: `Go to ${label}`, run: () => view.setTab(value) }))
}

/** Reviewing: approving (not your own PR) and finishing open the review box; nothing is sent from here. */
function listReviewActions(view: PullViewState, pr: PullDetail): PaletteAction[] {
  const finish = { id: 'finish', label: 'Finish the review…', run: () => view.review.setOpen('COMMENT') }
  if (pr.author === pr.viewer) {
    return [finish]
  }
  return [{ id: 'approve', label: 'Approve…', run: () => view.review.setOpen('APPROVE') }, finish]
}

/** Switching to only the changes since your review, when you reviewed the PR and it changed since. */
function listSinceReviewAction(view: PullViewState): PaletteAction[] {
  if (!view.sinceReview.available) {
    return []
  }
  return buildShortcutEntries(['since-review'])
}

/** What you can do on any tab of the PR. */
function listPullActions(view: PullViewState, pr: PullDetail): PaletteAction[] {
  return [
    ...listReviewActions(view, pr),
    ...listTabActions(view),
    ...buildShortcutEntries(['quick-open', 'git-log', 'copy-branch']),
    ...listSinceReviewAction(view),
    { id: 'github', label: 'Open the PR on GitHub', run: () => globalThis.revio.openExternal(pr.url) },
  ]
}

function listOverviewActions(view: PullViewState): PaletteAction[] {
  if (view.briefing.status.loading) {
    return []
  }
  return [{ id: 'brief', label: 'Brief me', run: view.briefing.generate }]
}

/** How the diff shows, and its side panel. */
function listDisplayActions(view: PullViewState): PaletteAction[] {
  const otherLayout = toggleBetween(view.view, DIFF_VIEWS)
  const { threadFold } = view
  return [
    { id: 'layout', label: `Show the diff ${otherLayout}`, run: () => view.changeView(otherLayout) },
    { id: 'blame', label: 'Show or hide blame', run: () => view.setBlame(toggleBetween(view.blame, BLAME_STATES)) },
    {
      id: 'comments',
      label: 'Show or hide the comments panel',
      run: () => view.setCommentsPanel(toggleBetween(view.commentsPanel, PANEL_STATES)),
    },
    { id: 'fold', label: 'Minimize or expand comments', run: () => threadFold.setAll(!threadFold.all) },
  ]
}

function listFilesActions(view: PullViewState): PaletteAction[] {
  return [
    ...buildShortcutEntries([
      'toggle-viewed',
      'unview',
      'copy-file',
      'copy-permalink',
      'open-in-editor',
      'find',
      'find-usages',
    ]),
    ...listDisplayActions(view),
  ]
}

const LIST_TAB_ACTIONS: Record<PullTab, (view: PullViewState) => PaletteAction[]> = {
  overview: listOverviewActions,
  files: listFilesActions,
  commits: () => [],
}

/** The tab's own actions first, then the PR's. None until the PR has loaded. */
function buildPullPage(view: PullViewState): PalettePage {
  if (!view.pr) {
    return { name: 'Pull request', actions: [] }
  }
  return {
    name: 'Pull request',
    actions: [...LIST_TAB_ACTIONS[view.tab](view), ...listPullActions(view, view.pr)],
  }
}

/** Offers in the palette what can be done on the PR's current tab. */
export function usePullPalette(view: PullViewState) {
  usePalettePage(buildPullPage(view))
}
