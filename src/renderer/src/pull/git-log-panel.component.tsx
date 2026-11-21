import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { joinClassNames } from '../common/format.util.ts'
import { GitLogPanes } from '../gitlog/git-log.view.tsx'
import { usePanelLayout, usePullGitLog } from './use-pull-git-log.hook.ts'

interface PullGitLogProps {
  /** The PR's repository, `owner/name`. */
  repo: string
  /** The PR's branch, which the log starts on. */
  headRef: string
  /** The file open in Files changed, or null on the other tabs. */
  openPath: string | null
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
        title="Show or hide the git log (Ctrl+`)"
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
      <span className="kbd">⌃`</span>
    </div>
  )
}

/** The log itself: the commits with their filters, and the picked commit, for the PR's repository. */
function PullGitLogBody(props: PullGitLogProps & { followPath: boolean }) {
  const gitLog = usePullGitLog(props.repo, props.headRef, props.openPath, props.followPath)
  if (gitLog.repos !== null && !gitLog.repo) {
    return (
      <div className="p-6 text-center text-[12.5px] text-muted">
        No local clone of <span className="font-mono text-fg">{props.repo}</span> found. Add the folder that holds it
        under Settings → Editor to see its git log here.
      </div>
    )
  }
  return (
    <>
      {Boolean(gitLog.error) && <ErrorBanner className="m-3">{gitLog.error}</ErrorBanner>}
      {Boolean(gitLog.repo) && <GitLogPanes gitLog={gitLog} showBranches={false} />}
    </>
  )
}

/**
 * The PR's git log, docked along the bottom of every tab like an IDE's terminal: closed, it is a bar; open, the log
 * of the PR's repository from its branch, following the file open in Files changed. It reads the log only once
 * first opened, then keeps its place while closed.
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
