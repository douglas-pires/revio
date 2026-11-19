import type { PullFile } from '@shared/pull.types.ts'
import { memo } from 'react'
import { cx } from '../common/format.util.ts'
import { groupByDir } from './files.util.ts'

const PERCENT = 100

/** Sidebar list of changed files, grouped by folder, with viewed/focus/draft markers. */
export const FileTree = memo(function FileTreeView(props: {
  files: PullFile[]
  viewed: Record<string, string>
  current: string | null
  focusPaths: ReadonlySet<string>
  ignorePaths: ReadonlySet<string>
  draftCounts: ReadonlyMap<string, number>
  onSelect: (path: string) => void
}) {
  const viewedCount = props.files.filter((f) => props.viewed[f.path] === f.sha).length
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted">
        <span className="font-semibold tracking-wide uppercase">Files {props.files.length}</span>
        <span>
          {viewedCount}/{props.files.length} viewed
        </span>
      </div>
      <div className="mx-3 mb-2 h-1 overflow-hidden rounded bg-panel-2">
        <div
          className="h-full bg-ok transition-all"
          // biome-ignore lint/style/noInlineStyles: the bar's width is the share of files viewed.
          style={{ width: `${(viewedCount / Math.max(1, props.files.length)) * PERCENT}%` }}
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {groupByDir(props.files).map(([dir, files]) => (
          <li key={dir} className="mb-1">
            {Boolean(dir) && (
              <div
                className="truncate px-1.5 pt-1.5 pb-0.5 text-left font-mono text-[10.5px] text-muted [direction:rtl]"
                title={dir}
              >
                {dir}
              </div>
            )}
            {files.map((f) => {
              const viewed = props.viewed[f.path] === f.sha
              const drafts = props.draftCounts.get(f.path) ?? 0
              return (
                <button
                  type="button"
                  key={f.path}
                  onClick={() => props.onSelect(f.path)}
                  title={f.path}
                  className={cx(
                    'flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 pl-3 text-left hover:bg-hover',
                    (viewed || props.ignorePaths.has(f.path)) && 'opacity-55',
                    props.current === f.path && 'bg-hover ring-1 ring-accent/60',
                  )}
                >
                  <span
                    className={cx(
                      'size-1.5 shrink-0 rounded-full',
                      props.focusPaths.has(f.path) && 'bg-focus',
                      !props.focusPaths.has(f.path) && 'bg-transparent',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{f.path.slice(dir.length)}</span>
                  {drafts > 0 && <span className="chip bg-warn/20 text-warn">{drafts}</span>}
                  <span className="font-mono text-[10.5px] text-muted">{f.additions + f.deletions}</span>
                  {Boolean(viewed) && <span className="text-ok">✓</span>}
                </button>
              )
            })}
          </li>
        ))}
      </ul>
    </aside>
  )
})
