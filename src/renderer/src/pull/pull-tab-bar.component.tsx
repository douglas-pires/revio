import { cx } from '../common/format.util.ts'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
import { ToggleButton } from '../common/toggle-button.component.tsx'

import type { DiffView } from './diff-file.component.tsx'

const LABELS: Record<PullTab, string> = { overview: 'Overview', files: 'Files changed', commits: 'Commits' }

/** Overview / Files changed, plus the diff tools shown on the files tab. */
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

/** Where a toolbar toggle sits in the tab bar: centred, clear of the tabs' underline. */
const TOOL = 'mb-1.5 self-center'

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
        className={cx(TOOL, 'ml-auto')}
      >
        💬 {props.openThreadCount}
      </ToggleButton>
      <ToggleButton
        on={props.blame}
        onToggle={props.onToggleBlame}
        title={TOGGLE_TITLES.blame[String(props.blame) as 'true' | 'false']}
        className={cx(TOOL, GAP)}
      >
        Blame
      </ToggleButton>
      <ToggleButton
        on={props.threadsFolded}
        onToggle={props.onToggleThreadsFolded}
        title={TOGGLE_TITLES.fold[folded]}
        className={cx(TOOL, GAP)}
      >
        <span className="@4xl:hidden">{FOLD_LABELS[folded].short}</span>
        <span className="hidden @4xl:inline">{FOLD_LABELS[folded].full}</span>
      </ToggleButton>
      {/* A reminder only, shown when the bar has room for it. */}
      <span className="mb-1.5 ml-3 hidden shrink-0 self-center text-[11.5px] whitespace-nowrap text-muted @5xl:inline">
        <kbd className="kbd">j</kbd>/<kbd className="kbd">k</kbd> files · <kbd className="kbd">v</kbd> viewed
      </span>
      <SegmentedControl segments={VIEWS} value={props.view} onChange={props.onView} className={cx('mb-1.5', GAP)} />
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
  const { tab } = props
  return (
    // A size container: the files toolbar fits itself to the bar's width (narrower beside a side panel).
    <div className="@container flex shrink-0 gap-1 border-b border-line px-4 pt-2">
      {(['overview', 'files', 'commits'] as const).map((t) => (
        <button
          type="button"
          key={t}
          onClick={() => props.onTab(t)}
          className={cx(
            '-mb-px shrink-0 border-b-2 px-3 py-1.5 font-medium whitespace-nowrap @max-3xl:px-2',
            tab === t && 'border-accent text-fg',
            !(tab === t) && 'border-transparent text-muted hover:text-fg',
          )}
        >
          {LABELS[t]}
          {t === 'commits' && (
            <span className="ml-1.5 rounded-full bg-panel-2 px-1.5 text-[11px] text-muted">{props.commitCount}</span>
          )}
        </button>
      ))}
      {tab === 'files' && <FilesToolbar props={props} />}
    </div>
  )
}
