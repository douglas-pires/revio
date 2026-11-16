import type { FocusItem } from '@shared/claude.types'
import type { PullFile } from '@shared/pull.types'
import { cx } from '../common/format.util'

const STATUS: Record<string, string> = { added: 'A', removed: 'D', modified: 'M', renamed: 'R', copied: 'C', changed: 'M' }

/** The sticky bar above a file's diff: collapse, status, path, size, markers and the Viewed box. */
export function DiffFileHeader(props: {
  file: PullFile
  collapsed: boolean
  focus: readonly FocusItem[]
  ignoreReason?: string
  commentCount: number
  viewed: boolean
  onToggleCollapsed: () => void
  onToggleViewed: (viewed: boolean) => void
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-1.5">
      <button className="btn btn-ghost px-1" onClick={props.onToggleCollapsed} title={props.collapsed ? 'Expand' : 'Collapse'}>
        <svg viewBox="0 0 16 16" className={cx('size-3.5 transition', props.collapsed && '-rotate-90')} fill="currentColor">
          <path d="M4 6l4 4 4-4z" />
        </svg>
      </button>
      <span className="chip bg-panel font-mono text-muted">{STATUS[props.file.status] ?? '?'}</span>
      <span className="selectable truncate font-mono text-[12px]">
        {props.file.previousPath && <span className="text-muted">{props.file.previousPath} → </span>}
        {props.file.path}
      </span>
      <span className="font-mono text-[11.5px]">
        <span className="text-ok">+{props.file.additions}</span> <span className="text-danger">−{props.file.deletions}</span>
      </span>
      {props.focus.length > 0 && (
        <span className="chip bg-focus/15 text-focus" title={props.focus.map((f) => f.reason).join('\n')}>
          ● focus
        </span>
      )}
      {props.ignoreReason && (
        <span className="chip bg-panel text-muted" title={props.ignoreReason}>
          skip
        </span>
      )}
      {props.commentCount > 0 && <span className="chip bg-accent/15 text-accent">{props.commentCount} 💬</span>}
      <div className="flex-1" />
      <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
        <input
          type="checkbox"
          checked={props.viewed}
          onChange={(e) => props.onToggleViewed(e.target.checked)}
        />
        Viewed
      </label>
    </div>
  )
}
