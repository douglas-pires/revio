import { InnerTabs } from '../common/inner-tabs.component.tsx'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
import { ToggleButton } from '../common/toggle-button.component.tsx'
import { ShortcutHint } from '../shortcuts/shortcut-hint.component.tsx'
import type { DiffView } from './diff-file.types.ts'
import { listPullTabs, type PullTab } from './pull-tabs.util.ts'

/** Tooltips for the toggles, by whether they are on. */
const TOGGLE_TITLES = {
  comments: { true: 'Hide the comments panel', false: 'Show every comment thread in a panel' },
  blame: {
    true: 'Stop showing who last changed each line',
    false: 'Show who last changed each line when you hover it',
  },
  since: {
    true: 'Show the whole PR again',
    false: 'Show only what changed since your last review',
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

/** "Since your review", or "Since review" when a side panel narrows the bar. */
function SinceLabel() {
  return (
    <>
      <span className="@4xl:hidden">Since review</span>
      <span className="hidden @4xl:inline">Since your review</span>
    </>
  )
}

/** The files tab's controls: only the changes since your review, the comments panel, blame, minimised threads, the shortcuts and the diff layout. */
function FilesToolbar({ props }: { props: PullTabBarProps }) {
  const folded = String(props.threadsFolded) as 'true' | 'false'
  const { sinceReview } = props
  return (
    <>
      {sinceReview === 'unchanged' && (
        <span
          className="mr-3 shrink-0 cursor-default self-center rounded-md px-2 py-0.5 text-[12px] whitespace-nowrap text-muted/60 @max-3xl:mr-1.5"
          title="Nothing was pushed to this PR since your last review"
        >
          <SinceLabel /> · 0
        </span>
      )}
      {sinceReview !== null && sinceReview !== 'unchanged' && (
        <ShortcutHint
          action="since-review"
          description={TOGGLE_TITLES.since[String(sinceReview.on) as 'true' | 'false']}
          className="mr-3 @max-3xl:mr-1.5"
        >
          <ToggleButton on={sinceReview.on} onToggle={sinceReview.onToggle}>
            <SinceLabel />
            {sinceReview.count !== null && ` · ${sinceReview.count}`}
          </ToggleButton>
        </ShortcutHint>
      )}
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
        <kbd className="kbd">j</kbd>/<kbd className="kbd">k</kbd> files · <kbd className="kbd">v</kbd> viewed ·{' '}
        <kbd className="kbd">⌘</kbd>-click usages
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
  /**
   * The switch to only the changes since your last review, with how many files changed; "unchanged" when nothing was
   * pushed since your review; null when you have not reviewed the PR.
   */
  sinceReview: { on: boolean; count: number | null; onToggle: () => void } | 'unchanged' | null
}

export function PullTabBar(props: PullTabBarProps) {
  const tabs = listPullTabs(props.commitCount)
  return (
    <InnerTabs tabs={tabs} value={props.tab} onChange={props.onTab}>
      {props.tab === 'files' && <FilesToolbar props={props} />}
    </InnerTabs>
  )
}
