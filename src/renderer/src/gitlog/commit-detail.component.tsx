import type { CiState, CommitDetail, FileChange, FileChangeStatus } from '@shared/git-log.types.ts'
import { CopyButton } from '../common/copy-button.component.tsx'
import { countOf, cx } from '../common/format.util.ts'
import { groupBy } from '../common/group.util.ts'

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

function ChangedFile({ change }: { change: FileChange }) {
  const look = STATUS_LOOK[change.status]
  return (
    <div className="flex items-center gap-1.5 pl-3" title={describeChange(change)}>
      <span className={cx('w-3 shrink-0 font-mono text-[11px]', look.className)}>{change.status}</span>
      <span className={cx('truncate font-mono', look.className)}>{readFileName(change.path)}</span>
    </div>
  )
}

/** Changed files grouped by folder, like an IDE's changes tree, one level deep. */
function ChangedFiles({ files }: { files: readonly FileChange[] }) {
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
            <ChangedFile key={change.path} change={change} />
          ))}
        </div>
      ))}
    </div>
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
}) {
  if (!props.hash) {
    return (
      <aside className="flex w-96 shrink-0 items-center justify-center border-l border-line bg-panel p-6 text-center text-muted">
        Pick a commit to see its files and message.
      </aside>
    )
  }
  const { detail } = props
  return (
    <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l border-line bg-panel">
      {Boolean(props.error) && <div className="p-3 text-[12px] text-danger">{props.error}</div>}
      {!(detail || props.error) && <div className="p-3 text-[12px] text-muted">Reading the commit…</div>}
      {detail !== null && (
        <>
          <div className="border-b border-line p-3">
            <ChangedFiles files={detail.files} />
          </div>
          <CommitSummary repo={props.repo} detail={detail} ci={props.ci} />
        </>
      )}
    </aside>
  )
}
