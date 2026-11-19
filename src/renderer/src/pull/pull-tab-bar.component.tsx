import { cx } from '../common/format.util.ts'

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
} as const

export type PullTab = 'overview' | 'files' | 'commits'

export function PullTabBar(props: {
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
}) {
  const { tab } = props
  return (
    <div className="flex shrink-0 gap-1 border-b border-line px-4 pt-2">
      {(['overview', 'files', 'commits'] as const).map((t) => (
        <button
          type="button"
          key={t}
          onClick={() => props.onTab(t)}
          className={cx(
            '-mb-px border-b-2 px-3 py-1.5 font-medium',
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
      {tab === 'files' && (
        <>
          <button
            type="button"
            className={cx(
              'mb-1.5 ml-auto self-center rounded px-2 py-0.5 text-[12px]',
              props.commentsPanelOpen && 'bg-hover text-fg',
              !props.commentsPanelOpen && 'text-muted hover:text-fg',
            )}
            title={TOGGLE_TITLES.comments[String(props.commentsPanelOpen) as 'true' | 'false']}
            onClick={props.onToggleCommentsPanel}
          >
            💬 {props.openThreadCount}
          </button>
          <button
            type="button"
            aria-pressed={props.blame}
            className={cx(
              'mb-1.5 ml-3 self-center rounded px-2 py-0.5 text-[12px]',
              props.blame && 'bg-hover text-fg',
              !props.blame && 'text-muted hover:text-fg',
            )}
            title={TOGGLE_TITLES.blame[String(props.blame) as 'true' | 'false']}
            onClick={props.onToggleBlame}
          >
            Blame
          </button>
          <span className="mb-1.5 ml-3 self-center text-[11.5px] text-muted">
            <kbd className="kbd">j</kbd>/<kbd className="kbd">k</kbd> files · <kbd className="kbd">v</kbd> viewed
          </span>
          <div className="mb-1.5 ml-3 flex rounded-md border border-line p-0.5">
            {(['unified', 'split'] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => props.onView(v)}
                className={cx(
                  'rounded px-2.5 py-0.5 text-[12px] capitalize',
                  props.view === v && 'bg-hover text-fg',
                  !(props.view === v) && 'text-muted hover:text-fg',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
