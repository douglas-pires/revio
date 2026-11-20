import { InnerTabs } from '../common/inner-tabs.component.tsx'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
import { ToggleButton } from '../common/toggle-button.component.tsx'

import type { DiffView } from './diff-file.component.tsx'

const LABELS: Record<PullTab, string> = { overview: 'Overview', files: 'Files changed', commits: 'Commits' }

/** Only the Commits tab carries a count. */
function commitCountOf(tab: PullTab, count: number): number | undefined {
  let shown: number | undefined
  if (tab === 'commits') {
    shown = count
  }
  return shown
}

/** Tooltips for the toggles, by whether they are on. */
const TOGGLE_TITLES = {
  comments: { true: 'Hide the comments panel', false: 'Show every comment thread in a panel' },
  blame: {
    true: 'Stop showing who last changed each line',
    false: 'Show who last changed each line when you hover it',
  },
  fold: {
    true: 'Show every comment thread in the diff in full',
    false: 'Minimize every comment thread in the diff to one line, to keep the code in view',
  },
} as const

/** The minimise toggle's label: full on a wide bar, one word on a narrow one (beside a side panel). */
const FOLD_LABELS = {
  true: { short: 'Expand', full: 'Expand comments' },
  false: { short: 'Minimize', full: 'Minimize comments' },
} as const

/** Spacing between the toolbar's controls: tighter when a side panel narrows the bar. */
const GAP = 'ml-3 @max-3xl:ml-1.5'

const VIEWS = [
  { value: 'unified', label: 'Unified' },
  { value: 'split', label: 'Split' },
] as const

/** The files tab's controls: the comments panel, blame, minimised threads, the shortcuts and the diff layout. */
function FilesToolbar({ props }: { props: PullTabBarProps }) {
  const folded = String(props.threadsFolded) as 'true' | 'false'
  return (
    <>
      <ToggleButton
        on={props.commentsPanelOpen}
        onToggle={props.onToggleCommentsPanel}
        title={TOGGLE_TITLES.comments[String(props.commentsPanelOpen) as 'true' | 'false']}
      >
        💬 {props.openThreadCount}
      </ToggleButton>
      <ToggleButton
        on={props.blame}
        onToggle={props.onToggleBlame}
        title={TOGGLE_TITLES.blame[String(props.blame) as 'true' | 'false']}
        className={GAP}
      >
        Blame
      </ToggleButton>
      <ToggleButton
        on={props.threadsFolded}
        onToggle={props.onToggleThreadsFolded}
        title={TOGGLE_TITLES.fold[folded]}
        className={GAP}
      >
        <span className="@4xl:hidden">{FOLD_LABELS[folded].short}</span>
        <span className="hidden @4xl:inline">{FOLD_LABELS[folded].full}</span>
      </ToggleButton>
      {/* A reminder only, shown when the bar has room for it. */}
      <span className="ml-3 hidden shrink-0 self-center text-[11.5px] whitespace-nowrap text-muted @5xl:inline">
        <kbd className="kbd">j</kbd>/<kbd className="kbd">k</kbd> files · <kbd className="kbd">v</kbd> viewed
      </span>
      <SegmentedControl segments={VIEWS} value={props.view} onChange={props.onView} className={GAP} />
    </>
  )
}

interface PullTabBarProps {
  tab: PullTab
  onTab: (tab: PullTab) => void
  commitCount: number
  openThreadCount: number
  commentsPanelOpen: boolean
  onToggleCommentsPanel: () => void
  view: DiffView
  onView: (view: DiffView) => void
  blame: boolean
  onToggleBlame: () => void
  threadsFolded: boolean
  onToggleThreadsFolded: () => void
}

export type PullTab = 'overview' | 'files' | 'commits'

export function PullTabBar(props: PullTabBarProps) {
  const tabs = (['overview', 'files', 'commits'] as const).map((t) => ({
    value: t,
    label: LABELS[t],
    count: commitCountOf(t, props.commitCount),
  }))
  return (
    <InnerTabs tabs={tabs} value={props.tab} onChange={props.onTab}>
      {props.tab === 'files' && <FilesToolbar props={props} />}
    </InnerTabs>
  )
}
