import type { FocusItem } from '@shared/claude.types.ts'
import type { PullFile } from '@shared/pull.types.ts'
import { CopyButton } from '../common/copy-button.component.tsx'
import { joinClassNames } from '../common/format.util.ts'
import { ExplainButton } from './explain-button.component.tsx'
import { describeRename } from './files.util.ts'
import { OpenInEditorButton } from './open-in-editor-button.component.tsx'

const STATUS: Record<string, string> = {
  added: 'A',
  removed: 'D',
  modified: 'M',
  renamed: 'R',
  copied: 'C',
  changed: 'M',
}

/** The sticky bar above a file's diff: collapse, status, path, size, markers and the Viewed box. */
function collapseLabel(collapsed: boolean) {
  if (collapsed) {
    return 'Expand'
  }
  return 'Collapse'
}

export function DiffFileHeader(props: {
  file: PullFile
  collapsed: boolean
  focus: readonly FocusItem[]
  ignoreReason?: string | undefined
  commentCount: number
  viewed: boolean
  onToggleCollapsed: () => void
  onToggleViewed: (viewed: boolean) => void
  onCommentOnFile: () => void
  onShowHistory: () => void
  onOpenInEditor: () => Promise<void>
  /** Why blame could not load for this file, if it failed. */
  blameError?: string | null
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-panel-2 px-3 py-1.5">
      <button
        type="button"
        className="btn btn-ghost px-1"
        onClick={props.onToggleCollapsed}
        title={collapseLabel(props.collapsed)}
        aria-label={collapseLabel(props.collapsed)}
      >
        <svg
          aria-hidden={true}
          viewBox="0 0 16 16"
          className={joinClassNames('size-3.5 transition', props.collapsed && '-rotate-90')}
          fill="currentColor"
        >
          <path d="M4 6l4 4 4-4z" />
        </svg>
      </button>
      <span className="chip shrink-0 bg-panel font-mono text-muted">{STATUS[props.file.status] ?? '?'}</span>
      <span className="selectable min-w-0 truncate font-mono text-[12px]" title={describeRename(props.file)}>
        {Boolean(props.file.previousPath) && <span className="text-muted">{props.file.previousPath} → </span>}
        {props.file.path}
      </span>
      <CopyButton
        text={props.file.path}
        title="Copy path"
        className="btn btn-ghost -ml-1 shrink-0 px-1 py-0 text-[12px]"
      >
        {''}
      </CopyButton>
      <span className="shrink-0 font-mono text-[11.5px] whitespace-nowrap">
        <span className="text-ok">+{props.file.additions}</span>{' '}
        <span className="text-danger">−{props.file.deletions}</span>
      </span>
      {props.focus.length > 0 && (
        <span
          className="chip shrink-0 bg-focus/15 whitespace-nowrap text-focus"
          title={props.focus.map((focusItem) => focusItem.reason).join('\n')}
        >
          ● focus
        </span>
      )}
      {Boolean(props.ignoreReason) && (
        <span className="chip shrink-0 bg-panel text-muted" title={props.ignoreReason}>
          skip
        </span>
      )}
      {props.commentCount > 0 && (
        <span className="chip shrink-0 bg-accent/15 whitespace-nowrap text-accent">{props.commentCount} 💬</span>
      )}
      {typeof props.blameError === 'string' && (
        <span className="chip shrink-0 bg-danger/10 text-danger" title={props.blameError}>
          no blame
        </span>
      )}
      <div className="flex-1" />
      <ExplainButton path={props.file.path} />
      <OpenInEditorButton onOpen={props.onOpenInEditor} />
      <button
        type="button"
        className="btn btn-ghost shrink-0 py-0 text-[12px] whitespace-nowrap text-muted hover:text-fg"
        onClick={props.onShowHistory}
        title="Commits that changed this file"
      >
        History
      </button>
      <button
        type="button"
        className="btn btn-ghost shrink-0 py-0 text-[12px] whitespace-nowrap text-muted hover:text-fg"
        onClick={props.onCommentOnFile}
        title="Comment on the whole file, without picking a line"
      >
        + File comment
      </button>
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-muted">
        <input
          type="checkbox"
          checked={props.viewed}
          onChange={(event) => props.onToggleViewed(event.target.checked)}
        />
        Viewed
      </label>
    </div>
  )
}
