import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { joinClassNames } from '../common/format.util.ts'
import { CommitDetailPanel } from '../gitlog/commit-detail.component.tsx'
import { CommitFileDiff } from '../gitlog/commit-file-diff.component.tsx'
import { CommitList } from '../gitlog/commit-list.component.tsx'
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

/** The bar along the bottom: opens and closes the log, and says which file it follows. */
function PanelBar(props: {
  open: boolean
  onToggle: () => void
  openPath: string | null
  followPath: boolean
  onFollowPath: (follow: boolean) => void
}) {
  const followedPath = props.followPath && props.openPath
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 px-3 text-[12px] text-muted">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold text-fg hover:bg-hover"
        aria-expanded={props.open}
        title="Show or hide the git log (Ctrl+G)"
        onClick={props.onToggle}
      >
        <span className={joinClassNames('text-[10px] transition', !props.open && 'rotate-180')}>▾</span>
        Git log
      </button>
      {Boolean(followedPath) && (
        <span className="min-w-0 truncate" title={props.openPath ?? ''}>
          history of <span className="font-mono text-fg">{readFileName(props.openPath ?? '')}</span>
        </span>
      )}
      <div className="flex-1" />
      <label className="flex items-center gap-1.5" title="Filter the log to the file open in Files changed">
        <input
          type="checkbox"
          checked={props.followPath}
          onChange={(event) => props.onFollowPath(event.target.checked)}
        />
        Follow open file
      </label>
      <span className="kbd">⌃G</span>
    </div>
  )
}

/** The left pane: the open file's diff in the picked commit, else the commits. */
function LogPane(props: {
  repo: string
  gitLog: PullGitLogState
  pathSuggestions: readonly string[]
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
function PullGitLogBody(props: PullGitLogProps & { followPath: boolean }) {
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
  const [mounted, setMounted] = useState(layout.open)
  useEffect(() => {
    if (layout.open) {
      setMounted(true)
    }
  }, [layout.open])
  return (
    <section aria-label="Git log" className="flex shrink-0 flex-col border-t border-line bg-panel">
      {Boolean(layout.open) && <ResizeHandle height={layout.height} onResize={layout.resize} />}
      <PanelBar
        open={layout.open}
        onToggle={layout.toggle}
        openPath={props.openPath}
        followPath={followPath}
        onFollowPath={setFollowPath}
      />
      {Boolean(mounted) && (
        <div
          hidden={!layout.open}
          // biome-ignore lint/style/noInlineStyles: the height you dragged the panel to.
          style={{ height: layout.height }}
          className="flex min-h-0 flex-col border-t border-line bg-bg"
        >
          <PullGitLogBody {...props} followPath={followPath} />
        </div>
      )}
    </section>
  )
}
