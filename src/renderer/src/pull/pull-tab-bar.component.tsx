import { cx } from '../common/format.util'
import type { DiffView } from './diff-file.component'

export type PullTab = 'overview' | 'files'

/** Overview / Files changed, plus the diff tools shown on the files tab. */
export function PullTabBar(props: {
  tab: PullTab
  onTab: (tab: PullTab) => void
  openThreadCount: number
  commentsPanelOpen: boolean
  onToggleCommentsPanel: () => void
  view: DiffView
  onView: (view: DiffView) => void
}) {
  const { tab } = props
  return (
    <div className="flex shrink-0 gap-1 border-b border-line px-4 pt-2">
      {(['overview', 'files'] as const).map((t) => (
        <button
          key={t}
          onClick={() => props.onTab(t)}
          className={cx('-mb-px border-b-2 px-3 py-1.5 font-medium', tab === t ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg')}
        >
          {t === 'overview' ? 'Overview' : 'Files changed'}
        </button>
      ))}
      {tab === 'files' && (
        <>
          <button
            className={cx('mb-1.5 ml-auto self-center rounded px-2 py-0.5 text-[12px]', props.commentsPanelOpen ? 'bg-hover text-fg' : 'text-muted hover:text-fg')}
            title={props.commentsPanelOpen ? 'Hide the comments panel' : 'Show every comment thread in a panel'}
            onClick={props.onToggleCommentsPanel}
          >
            💬 {props.openThreadCount}
          </button>
          <span className="mb-1.5 ml-3 self-center text-[11.5px] text-muted">
            <kbd className="kbd">j</kbd>/<kbd className="kbd">k</kbd> files · <kbd className="kbd">v</kbd> viewed
          </span>
          <div className="mb-1.5 ml-3 flex rounded-md border border-line p-0.5">
            {(['unified', 'split'] as const).map((v) => (
              <button
                key={v}
                onClick={() => props.onView(v)}
                className={cx('rounded px-2.5 py-0.5 text-[12px] capitalize', props.view === v ? 'bg-hover text-fg' : 'text-muted hover:text-fg')}
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
