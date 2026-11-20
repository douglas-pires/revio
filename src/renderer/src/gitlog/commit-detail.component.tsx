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
function changeTitle(f: FileChange) {
  if (f.from) {
    return `${f.from} → ${f.path}`
  }
  return f.path
}

const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1) || './'
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** Changed files grouped by folder, like an IDE's changes tree, one level deep. */
function ChangedFiles({ files }: { files: readonly FileChange[] }) {
  const byDir = groupBy(files, (f) => dirOf(f.path))
  return (
    <div className="text-[12px]">
      <div className="mb-1 text-[11px] font-semibold text-muted">{countOf(files.length, 'file', 'files')}</div>
      {[...byDir].map(([dir, inDir]) => (
        <div key={dir} className="mb-1.5">
          <div className="truncate font-mono text-[11px] text-muted" title={dir}>
            {dir}
          </div>
          {inDir.map((f) => (
            <div key={f.path} className="flex items-center gap-1.5 pl-3" title={changeTitle(f)}>
              <span className={cx('w-3 shrink-0 font-mono text-[11px]', STATUS_LOOK[f.status].className)}>
                {f.status}
              </span>
              <span className={cx('truncate font-mono', STATUS_LOOK[f.status].className)}>{nameOf(f.path)}</span>
            </div>
          ))}
        </div>
      ))}
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
  const d = props.detail
  const url = `https://github.com/${props.repo}/commit/${props.hash}`
  return (
    <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l border-line bg-panel">
      {Boolean(props.error) && <div className="p-3 text-[12px] text-danger">{props.error}</div>}
      {!(d || props.error) && <div className="p-3 text-[12px] text-muted">Reading the commit…</div>}
      {d !== null && (
        <>
          <div className="border-b border-line p-3">
            <ChangedFiles files={d.files} />
          </div>
          <div className="space-y-2 p-3">
            <pre className="selectable font-mono text-[12px] whitespace-pre-wrap">{d.message}</pre>
            <div className="text-[12px] text-muted">
              <span className="text-fg">{d.author}</span> &lt;{d.authorEmail}&gt; on {new Date(d.date).toLocaleString()}
              {d.committer !== d.author && <div>committed by {d.committer}</div>}
            </div>
            {props.ci && props.ci !== 'none' && <div className="text-[12px]">{CI_TEXT[props.ci]}</div>}
            <div className="flex items-center gap-3 text-[12px]">
              <CopyButton text={d.hash} title="Copy the full hash" className="font-mono text-muted hover:text-fg">
                {d.hash.slice(0, 10)}
              </CopyButton>
              <a
                href={url}
                className="text-accent hover:underline"
                onClick={(e) => {
                  e.preventDefault()
                  globalThis.revio.openExternal(url)
                }}
              >
                Open on GitHub
              </a>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
