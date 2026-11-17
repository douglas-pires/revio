import { useEffect, useMemo, useState } from 'react'
import type { FileHistoryEntry } from '@shared/history.types'
import { ago, cx, errorMessage } from '../common/format.util'
import { CopyButton } from '../common/copy-button.component'
import { parsePatch } from './diff.util'
import { StaticDiff } from './static-diff.component'

/** Right-hand sidebar: recent commits that changed a file (GitLens-style file history). Expand one to see its change. */
export function FileHistoryPanel(props: { repo: string; headSha: string; path: string; pull: { repo: string; number: number }; onClose: () => void }) {
  const { repo, headSha, path, pull } = props
  const [entries, setEntries] = useState<FileHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setEntries(null)
    setError(null)
    setOpen(null)
    window.revio
      .getFileHistory(pull, { repo, sha: headSha, path })
      .then((e) => live && setEntries(e))
      .catch((e) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [repo, headSha, path, pull])

  return (
    <aside data-file-history className="flex w-96 shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted">
        <span className="font-semibold tracking-wide uppercase">History</span>
        <span className="min-w-0 truncate font-mono" title={path}>
          {path.split('/').pop()}
        </span>
        <div className="flex-1" />
        <button className="rounded px-1.5 py-0.5 hover:text-fg" title="Hide history" aria-label="Hide history" onClick={props.onClose}>
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {error && <div className="px-3 py-4 text-[12px] text-danger">{error}</div>}
        {!entries && !error && <div className="px-3 py-8 text-center text-[12px] text-muted">Loading history…</div>}
        {entries && !entries.length && <div className="px-3 py-8 text-center text-[12px] text-muted">No commits found for this file.</div>}
        <ol>
          {entries?.map((c) => (
            <HistoryEntry key={c.sha} entry={c} repo={repo} path={path} open={open === c.sha} onToggle={() => setOpen(open === c.sha ? null : c.sha)} />
          ))}
        </ol>
      </div>
    </aside>
  )
}

function HistoryEntry({ entry: c, repo, path, open, onToggle }: { entry: FileHistoryEntry; repo: string; path: string; open: boolean; onToggle: () => void }) {
  return (
    <li className={cx('border-b border-line', open && 'bg-bg/40')}>
      <button className="flex w-full gap-2 px-3 py-2 text-left hover:bg-hover" onClick={onToggle} aria-expanded={open}>
        {c.authorAvatar ? <img src={c.authorAvatar} alt="" className="mt-0.5 size-5 shrink-0 rounded-full" /> : <span className="mt-0.5 size-5 shrink-0 rounded-full bg-panel-2" />}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[12.5px]">{c.headline}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
            <span>{c.author}</span>·<span title={new Date(c.date).toLocaleString()}>{ago(c.date)} ago</span>
            {c.inThisPr && <span className="chip bg-accent/15 text-accent">this PR</span>}
          </span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className="mb-2 flex items-center gap-2 text-[11.5px]">
            <CopyButton text={c.sha} title={`Copy commit sha ${c.sha}`} className="rounded px-1 font-mono text-muted hover:bg-hover hover:text-fg">
              {c.shortSha}
            </CopyButton>
            <div className="flex-1" />
            <button className="btn btn-ghost py-0" onClick={() => void window.revio.openExternal(c.url)}>
              Open commit ↗
            </button>
          </div>
          <CommitChange repo={repo} sha={c.sha} path={path} />
        </div>
      )}
    </li>
  )
}

/** The commit's change to the file. */
function CommitChange({ repo, sha, path }: { repo: string; sha: string; path: string }) {
  const [patch, setPatch] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    window.revio
      .getCommitFilePatch({ repo, sha, path })
      .then((p) => live && setPatch(p))
      .catch((e) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [repo, sha, path])
  const rows = useMemo(() => (patch ? parsePatch(patch) : []), [patch])
  if (error) return <div className="text-[12px] text-danger">{error}</div>
  if (patch === undefined) return <div className="text-[12px] text-muted">Loading change…</div>
  if (!patch) return <div className="text-[12px] text-muted">No diff to show (binary or too large).</div>
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-line bg-panel">
      <StaticDiff path={path} rows={rows} sourceLength={patch.length} />
    </div>
  )
}
