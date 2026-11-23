import type { CiState, CommitDetail, FileChange, FileChangeStatus } from '@shared/git-log.types.ts'
import { CopyButton } from '../common/copy-button.component.tsx'
import { countOf, joinClassNames } from '../common/format.util.ts'
import { groupBy } from '../common/group.util.ts'
import { ResizablePanel } from '../common/resizable-panel.component.tsx'
import { useCommitChecks } from './use-commit-extras.hook.ts'

const STATUS_LOOK: Record<FileChangeStatus, { className: string; title: string }> = {
  A: { className: 'text-ok', title: 'Added' },
  M: { className: 'text-accent', title: 'Modified' },
  D: { className: 'text-danger', title: 'Deleted' },
  R: { className: 'text-warn', title: 'Renamed' },
  C: { className: 'text-warn', title: 'Copied' },
  T: { className: 'text-muted', title: 'Type changed' },
}

const CI_TEXT: Record<CiState, string> = {
  success: '✓ Checks passed',
  failure: '✕ Checks failed',
  pending: '• Checks running',
  none: '',
}

/** A rename or copy shows where the file came from. */
function describeChange(change: FileChange) {
  if (change.from) {
    return `${change.from} → ${change.path}`
  }
  return change.path
}

/** The folder part of a path, with its trailing "/"; "./" for a file at the root. */
const readFolder = (path: string) => path.slice(0, path.lastIndexOf('/') + 1) || './'
const readFileName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** One changed file; click to see its diff. The open file is highlighted. */
function ChangedFile({ change, open, onOpen }: { change: FileChange; open: boolean; onOpen: (path: string) => void }) {
  const look = STATUS_LOOK[change.status]
  return (
    <button
      type="button"
      className={joinClassNames(
        'flex w-full items-center gap-1.5 rounded py-0.5 pl-3 text-left',
        open && 'bg-accent/15',
        !open && 'hover:bg-hover',
      )}
      title={`${describeChange(change)} — show the diff`}
      onClick={() => onOpen(change.path)}
    >
      <span className={joinClassNames('w-3 shrink-0 font-mono text-[11px]', look.className)}>{change.status}</span>
      <span className={joinClassNames('truncate font-mono', look.className)}>{readFileName(change.path)}</span>
    </button>
  )
}

/** Changed files grouped by folder, like an IDE's changes tree, one level deep. */
function ChangedFiles(props: {
  files: readonly FileChange[]
  openFile: string | null
  onOpenFile: (path: string) => void
}) {
  const { files } = props
  const filesByFolder = groupBy(files, (change) => readFolder(change.path))
  return (
    <div className="text-[12px]">
      <div className="mb-1 text-[11px] font-semibold text-muted">{countOf(files.length, 'file', 'files')}</div>
      {[...filesByFolder].map(([folder, folderFiles]) => (
        <div key={folder} className="mb-1.5">
          <div className="truncate font-mono text-[11px] text-muted" title={folder}>
            {folder}
          </div>
          {folderFiles.map((change) => (
            <ChangedFile
              key={change.path}
              change={change}
              open={change.path === props.openFile}
              onOpen={props.onOpenFile}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

const CHECK_MARKS: Record<CiState, { className: string; mark: string }> = {
  success: { className: 'text-ok', mark: '✓' },
  failure: { className: 'text-danger', mark: '✕' },
  pending: { className: 'text-warn', mark: '•' },
  none: { className: 'text-muted', mark: '·' },
}

/** Each GitHub check on the commit with its result, failing ones first; a click opens its details. */
function CommitChecks({ repo, hash }: { repo: string; hash: string }) {
  const checks = useCommitChecks(repo, hash)
  if (checks.error) {
    return <div className="text-[12px] text-danger">Could not read the checks: {checks.error}</div>
  }
  if (!checks.value?.length) {
    return null
  }
  return (
    <ul className="space-y-0.5 text-[12px]">
      {checks.value.map((check) => (
        <li key={check.name} className="flex items-center gap-1.5">
          <span
            className={joinClassNames('w-3 shrink-0 text-center font-semibold', CHECK_MARKS[check.state].className)}
          >
            {CHECK_MARKS[check.state].mark}
          </span>
          <CheckName name={check.name} url={check.url} />
        </li>
      ))}
    </ul>
  )
}

/** A check's name, linked to its details when GitHub gives a link. */
function CheckName({ name, url }: { name: string; url: string | null }) {
  if (!url) {
    return <span className="truncate">{name}</span>
  }
  return (
    <a
      href={url}
      className="truncate text-fg hover:underline"
      onClick={(event) => {
        event.preventDefault()
        globalThis.revio.openExternal(url)
      }}
    >
      {name}
    </a>
  )
}

/** The commit's message, who wrote and committed it, its CI result, hash and GitHub link. */
function CommitSummary({ repo, detail, ci }: { repo: string; detail: CommitDetail; ci: CiState | undefined }) {
  const url = `https://github.com/${repo}/commit/${detail.hash}`
  return (
    <div className="space-y-2 p-3">
      <pre className="selectable font-mono text-[12px] whitespace-pre-wrap">{detail.message}</pre>
      <div className="text-[12px] text-muted">
        <span className="text-fg">{detail.author}</span> &lt;{detail.authorEmail}&gt; on{' '}
        {new Date(detail.date).toLocaleString()}
        {detail.committer !== detail.author && <div>committed by {detail.committer}</div>}
      </div>
      {ci !== undefined && ci !== 'none' && <div className="text-[12px]">{CI_TEXT[ci]}</div>}
      <CommitChecks repo={repo} hash={detail.hash} />
      <div className="flex items-center gap-3 text-[12px]">
        <CopyButton text={detail.hash} title="Copy the full hash" className="font-mono text-muted hover:text-fg">
          {detail.hash.slice(0, 10)}
        </CopyButton>
        <a
          href={url}
          className="text-accent hover:underline"
          onClick={(event) => {
            event.preventDefault()
            globalThis.revio.openExternal(url)
          }}
        >
          Open on GitHub
        </a>
      </div>
    </div>
  )
}

/** Right pane: the picked commit's files and message, with its hash, author and a link to GitHub. */
export function CommitDetailPanel(props: {
  repo: string
  hash: string | null
  detail: CommitDetail | null
  ci: CiState | undefined
  error: string | null
  openFile: string | null
  onOpenFile: (path: string) => void
}) {
  if (!props.hash) {
    return (
      <ResizablePanel
        name="commit-detail"
        edge="left"
        defaultWidth={384}
        minWidth={280}
        label="Resize the commit details"
        className="flex items-center justify-center border-l border-line bg-panel p-6 text-center text-muted"
      >
        Pick a commit to see its files and message.
      </ResizablePanel>
    )
  }
  const { detail } = props
  return (
    <ResizablePanel
      name="commit-detail"
      edge="left"
      defaultWidth={384}
      minWidth={280}
      label="Resize the commit details"
      className="border-l border-line bg-panel"
    >
      {/* The scrolling lives inside, so the resize edge on the panel's border is not clipped. */}
      <div className="h-full overflow-y-auto">
        {Boolean(props.error) && <div className="p-3 text-[12px] text-danger">{props.error}</div>}
        {!(detail || props.error) && <div className="p-3 text-[12px] text-muted">Reading the commit…</div>}
        {detail !== null && (
          <>
            <div className="border-b border-line p-3">
              <ChangedFiles files={detail.files} openFile={props.openFile} onOpenFile={props.onOpenFile} />
            </div>
            <CommitSummary repo={props.repo} detail={detail} ci={props.ci} />
          </>
        )}
      </div>
    </ResizablePanel>
  )
}
