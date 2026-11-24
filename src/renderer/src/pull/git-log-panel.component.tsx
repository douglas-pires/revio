import { formatShortcut } from '@shared/shortcut.util.ts'
import { type PointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { joinClassNames } from '../common/format.util.ts'
import { CommitDetailPanel } from '../gitlog/commit-detail.component.tsx'
import { CommitFileDiff } from '../gitlog/commit-file-diff.component.tsx'
import { CommitList } from '../gitlog/commit-list.component.tsx'
import { ShortcutEditor } from '../shortcuts/shortcut-editor.component.tsx'
import { useShortcuts } from '../shortcuts/shortcuts.context.ts'
import { listPathSuggestions } from './pull-git-log.util.ts'
import { usePanelLayout } from './use-panel-layout.hook.ts'
import { type CommitPick, type PullGitLogState, type PullLogSource, usePullGitLog } from './use-pull-git-log.hook.ts'

interface PullGitLogProps extends PullLogSource {
  /** The PR's changed files, suggested in the path filter. */
  files: readonly { path: string }[]
  /** The file open in Files changed, or null on the other tabs. */
  openPath: string | null
  /** The commit last opened on the Commits tab, which the log picks. */
  commitPick: CommitPick | null
}

/** A file opened in one commit; it counts as open only while that commit stays picked. */
interface OpenedFile {
  hash: string | null
  path: string | null
}

/** The open file's path, or null once another commit is picked. */
function readOpenFile(opened: OpenedFile, selectedHash: string | null) {
  if (opened.hash !== selectedHash) {
    return null
  }
  return opened.path
}

/** The file whose diff is open; picking another commit closes it. */
function useOpenFile(selectedHash: string | null) {
  const [opened, setOpened] = useState<OpenedFile>({ hash: null, path: null })
  const openFile = (path: string | null) => setOpened({ hash: selectedHash, path })
  return [readOpenFile(opened, selectedHash), openFile] as const
}

/** The top edge of the open panel: drag it to make the panel taller or shorter. */
function ResizeHandle({ height, onResize }: { height: number; onResize: (height: number) => void }) {
  const drag = useRef<{ startY: number; startHeight: number } | null>(null)
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startHeight: height }
  }
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      onResize(drag.current.startHeight + drag.current.startY - event.clientY)
    }
  }
  return (
    <div
      aria-hidden={true}
      className="-mt-1 h-2 shrink-0 cursor-row-resize hover:bg-accent/30"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={() => {
        drag.current = null
      }}
    />
  )
}

/** The file name the log follows, shown in the bar. */
const readFileName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/**
 * The bar along the bottom of the PR: the Git log toggle with its shortcut and the file it follows. The rest of the
 * bar is left free for other tools to dock here.
 */
function PanelBar(props: { open: boolean; onToggle: () => void; followedPath: string | null }) {
  const shortcutHint = formatShortcut(useShortcuts().shortcuts['git-log'])
  let title = 'Show or hide the git log'
  if (shortcutHint) {
    title = `${title} (${shortcutHint})`
  }
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 px-3 text-[12px] text-muted">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold text-fg hover:bg-hover"
        aria-expanded={props.open}
        title={title}
        onClick={props.onToggle}
      >
        <span className={joinClassNames('text-[10px] transition', !props.open && 'rotate-180')}>▾</span>
        Git log
      </button>
      <ShortcutEditor action="git-log" popoverClassName="absolute bottom-full left-0 z-30 mb-2 w-72" />
      {props.followedPath !== null && (
        <span className="ml-2 min-w-0 truncate" title={props.followedPath}>
          history of <span className="font-mono text-fg">{readFileName(props.followedPath)}</span>
        </span>
      )}
    </div>
  )
}

/** Inside the log, beside its filters: whether the path filter follows the file open in Files changed. */
function FollowFileToggle({
  followPath,
  onFollowPath,
}: {
  followPath: boolean
  onFollowPath: (follow: boolean) => void
}) {
  return (
    <label
      className="flex items-center gap-1.5 text-[12px] text-muted"
      title="Filter the log to the file open in Files changed"
    >
      <input type="checkbox" checked={followPath} onChange={(event) => onFollowPath(event.target.checked)} />
      Follow open file
    </label>
  )
}

/** The left pane: the open file's diff in the picked commit, else the commits. */
function LogPane(props: {
  repo: string
  gitLog: PullGitLogState
  pathSuggestions: readonly string[]
  filterExtras: ReactNode
  openFile: string | null
  onCloseFile: () => void
}) {
  const { gitLog } = props
  if (props.openFile !== null && gitLog.commit.selected !== null) {
    return (
      <CommitFileDiff
        repo={props.repo}
        hash={gitLog.commit.selected}
        path={props.openFile}
        onClose={props.onCloseFile}
      />
    )
  }
  return (
    <CommitList
      commits={gitLog.commits}
      messageQuery={gitLog.messageQuery}
      filters={gitLog.filters}
      suggestions={{ authors: gitLog.authors, paths: props.pathSuggestions }}
      filterExtras={props.filterExtras}
      onFilters={gitLog.setFilters}
      ci={gitLog.ci}
      selected={gitLog.commit.selected}
      onSelect={gitLog.commit.setSelected}
      loading={gitLog.loading}
      more={gitLog.more}
      onLoadMore={gitLog.loadMore}
    />
  )
}

/** The log itself, from GitHub: the commits (or a file's diff) and the picked commit, side by side. */
function PullGitLogBody(props: PullGitLogProps & { followPath: boolean; onFollowPath: (follow: boolean) => void }) {
  const gitLog = usePullGitLog(props, props.openPath, props.followPath)
  const [openFile, setOpenFile] = useOpenFile(gitLog.commit.selected)
  const pathSuggestions = useMemo(() => listPathSuggestions(props.files.map((file) => file.path)), [props.files])
  const { setSelected } = gitLog.commit
  useEffect(() => {
    if (props.commitPick) {
      setSelected(props.commitPick.sha)
    }
  }, [props.commitPick, setSelected])
  return (
    <>
      {Boolean(gitLog.error) && <ErrorBanner className="m-3">{gitLog.error}</ErrorBanner>}
      <div className="flex min-h-0 flex-1">
        <LogPane
          repo={props.repo}
          gitLog={gitLog}
          pathSuggestions={pathSuggestions}
          filterExtras={<FollowFileToggle followPath={props.followPath} onFollowPath={props.onFollowPath} />}
          openFile={openFile}
          onCloseFile={() => setOpenFile(null)}
        />
        <CommitDetailPanel
          repo={props.repo}
          hash={gitLog.commit.selected}
          detail={gitLog.commit.detail}
          ci={gitLog.ci[gitLog.commit.selected ?? '']}
          error={gitLog.commit.error}
          openFile={openFile}
          onOpenFile={setOpenFile}
        />
      </div>
    </>
  )
}

/**
 * The PR's git log, docked along the bottom of every tab like an IDE's terminal: closed, it is a bar; open, the
 * history GitHub has from the PR's head, following the file open in Files changed. It asks GitHub only once first
 * opened, then keeps its place while closed.
 */
export function GitLogPanel(props: PullGitLogProps) {
  const layout = usePanelLayout()
  const [followPath, setFollowPath] = useState(true)
  let followedPath: string | null = null
  if (followPath && props.openPath) {
    followedPath = props.openPath
  }
  const [mounted, setMounted] = useState(layout.open)
  useEffect(() => {
    if (layout.open) {
      setMounted(true)
    }
  }, [layout.open])
  return (
    <section aria-label="Git log" className="flex shrink-0 flex-col border-t border-line bg-panel">
      {Boolean(layout.open) && <ResizeHandle height={layout.height} onResize={layout.resize} />}
      <PanelBar open={layout.open} onToggle={layout.toggle} followedPath={followedPath} />
      {Boolean(mounted) && (
        <div
          hidden={!layout.open}
          // biome-ignore lint/style/noInlineStyles: the height you dragged the panel to.
          style={{ height: layout.height }}
          className="flex min-h-0 flex-col border-t border-line bg-bg"
        >
          <PullGitLogBody {...props} followPath={followPath} onFollowPath={setFollowPath} />
        </div>
      )}
    </section>
  )
}
