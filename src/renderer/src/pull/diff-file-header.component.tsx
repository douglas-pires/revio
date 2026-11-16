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
  onCommentOnFile: () => void
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-1.5">
      <button className="btn btn-ghost px-1" onClick={props.onToggleCollapsed} title={props.collapsed ? 'Expand' : 'Collapse'}>
        <svg viewBox="0 0 16 16" className={cx('size-3.5 transition', props.collapsed && '-rotate-90')} fill="currentColor">
          <path d="M4 6l4 4 4-4z" />
        </svg>
      </button>
      <span className="chip shrink-0 bg-panel font-mono text-muted">{STATUS[props.file.status] ?? '?'}</span>
      <span className="selectable min-w-0 truncate font-mono text-[12px]">
        {props.file.previousPath && <span className="text-muted">{props.file.previousPath} → </span>}
        {props.file.path}
      </span>
      <span className="shrink-0 font-mono text-[11.5px] whitespace-nowrap">
        <span className="text-ok">+{props.file.additions}</span> <span className="text-danger">−{props.file.deletions}</span>
      </span>
      {props.focus.length > 0 && (
        <span className="chip shrink-0 bg-focus/15 whitespace-nowrap text-focus" title={props.focus.map((f) => f.reason).join('\n')}>
          ● focus
        </span>
      )}
      {props.ignoreReason && (
        <span className="chip shrink-0 bg-panel text-muted" title={props.ignoreReason}>
          skip
        </span>
      )}
      {props.commentCount > 0 && <span className="chip shrink-0 bg-accent/15 whitespace-nowrap text-accent">{props.commentCount} 💬</span>}
      <div className="flex-1" />
      <button className="btn btn-ghost shrink-0 py-0 text-[12px] whitespace-nowrap text-muted hover:text-fg" onClick={props.onCommentOnFile} title="Comment on the whole file, without picking a line">
        + File comment
      </button>
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-muted">
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
