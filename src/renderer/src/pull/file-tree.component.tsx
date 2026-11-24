import type { PullFile } from '@shared/pull.types.ts'
import { memo } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { PanelHeader } from '../common/panel-header.component.tsx'
import { ResizablePanel } from '../common/resizable-panel.component.tsx'
import { groupByDir } from './files.util.ts'
import { useUnsentPaths } from './unsent-comments.util.ts'

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
  const unsentPaths = useUnsentPaths()
  const viewedCount = props.files.filter((file) => props.viewed[file.path] === file.sha).length
  return (
    <ResizablePanel
      name="files"
      edge="right"
      defaultWidth={288}
      label="Resize the files list"
      className="flex flex-col border-r border-line bg-panel"
    >
      <PanelHeader
        title="Files"
        detail={props.files.length}
        actions={
          <span>
            {viewedCount}/{props.files.length} viewed
          </span>
        }
      />
      <div className="mx-3 my-2 h-1 overflow-hidden rounded bg-panel-2">
        <div
          className="h-full bg-ok transition-all"
          // biome-ignore lint/style/noInlineStyles: the bar's width is the share of files viewed.
          style={{ width: `${(viewedCount / Math.max(1, props.files.length)) * PERCENT}%` }}
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {groupByDir(props.files).map(([directory, files]) => (
          <li key={directory} className="mb-1">
            {Boolean(directory) && (
              <div
                className="truncate px-1.5 pt-1.5 pb-0.5 text-left font-mono text-[10.5px] text-muted [direction:rtl]"
                title={directory}
              >
                {directory}
              </div>
            )}
            {files.map((file) => {
              const viewed = props.viewed[file.path] === file.sha
              const drafts = props.draftCounts.get(file.path) ?? 0
              return (
                <button
                  type="button"
                  key={file.path}
                  onClick={() => props.onSelect(file.path)}
                  title={file.path}
                  className={joinClassNames(
                    'flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 pl-3 text-left hover:bg-hover',
                    (viewed || props.ignorePaths.has(file.path)) && 'opacity-55',
                    props.current === file.path && 'bg-hover ring-1 ring-accent/60',
                  )}
                >
                  <span
                    className={joinClassNames(
                      'size-1.5 shrink-0 rounded-full',
                      props.focusPaths.has(file.path) && 'bg-focus',
                      !props.focusPaths.has(file.path) && 'bg-transparent',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">
                    {file.path.slice(directory.length)}
                  </span>
                  {unsentPaths.has(file.path) && (
                    <span className="text-warn" title="You left a comment here without sending it">
                      ✎
                    </span>
                  )}
                  {drafts > 0 && <span className="chip bg-warn/20 text-warn">{drafts}</span>}
                  <span className="font-mono text-[10.5px] text-muted">{file.additions + file.deletions}</span>
                  {Boolean(viewed) && <span className="text-ok">✓</span>}
                </button>
              )
            })}
          </li>
        ))}
      </ul>
    </ResizablePanel>
  )
})
