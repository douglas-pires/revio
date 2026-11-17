import { useEffect, useMemo, useState } from 'react'
import type { CommitFile, PullCommit } from '@shared/history.types'
import type { PullRef } from '@shared/pull.types'
import { ago, cx, errorMessage } from '../common/format.util'
import { CopyButton } from '../common/copy-button.component'
import { ErrorBanner } from '../common/error-banner.component'
import { parsePatch } from './diff.util'
import { StaticDiff } from './static-diff.component'

/** The PR's commits, oldest first like GitHub. Expand one for its full message and the files it changed. */
export function CommitsTab({ pull, headSha }: { pull: PullRef; headSha: string }) {
  const [commits, setCommits] = useState<PullCommit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    window.revio
      .getPullCommits(pull, headSha)
      .then((c) => live && setCommits(c))
      .catch((e) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [pull, headSha])

  if (error) return <div className="p-6"><ErrorBanner>{error}</ErrorBanner></div>
  if (!commits) return <div className="p-6 text-center text-muted">Loading commits…</div>
  return (
    <ol data-commits className="mx-auto max-w-5xl space-y-2 px-6 py-5">
      {commits.map((c, i) => (
        <CommitRow key={c.sha} commit={c} index={i + 1} repo={pull.repo} open={open === c.sha} onToggle={() => setOpen(open === c.sha ? null : c.sha)} />
      ))}
    </ol>
  )
}

function CommitRow({ commit: c, index, repo, open, onToggle }: { commit: PullCommit; index: number; repo: string; open: boolean; onToggle: () => void }) {
  const details = c.message.slice(c.headline.length).trim()
  return (
    <li className={cx('overflow-hidden rounded-lg border bg-panel', open ? 'border-accent/50' : 'border-line')}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted">{index}</span>
        {c.authorAvatar ? <img src={c.authorAvatar} alt="" className="size-6 shrink-0 rounded-full" /> : <span className="size-6 shrink-0 rounded-full bg-panel-2" />}
        <button className="min-w-0 flex-1 text-left" onClick={onToggle} aria-expanded={open}>
          <div className="truncate text-[13px] font-medium hover:underline">{c.headline}</div>
          <div className="text-[11.5px] text-muted">
            {c.author} committed <span title={new Date(c.date).toLocaleString()}>{ago(c.date)} ago</span>
          </div>
        </button>
        <CopyButton text={c.sha} title={`Copy commit sha ${c.sha}`} className="shrink-0 rounded px-1 font-mono text-[11.5px] text-muted hover:bg-hover hover:text-fg">
          {c.shortSha}
        </CopyButton>
        <button className="btn btn-ghost shrink-0 py-0 text-[12px]" onClick={() => void window.revio.openExternal(c.url)}>
          GitHub ↗
        </button>
      </div>
      {open && (
        <div className="border-t border-line">
          {details && <pre className="border-b border-line px-4 py-2 font-sans text-[12.5px] whitespace-pre-wrap text-muted">{details}</pre>}
          <CommitFiles repo={repo} sha={c.sha} />
        </div>
      )}
    </li>
  )
}

/** The files a commit changed; each opens to its diff. */
function CommitFiles({ repo, sha }: { repo: string; sha: string }) {
  const [files, setFiles] = useState<CommitFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let live = true
    window.revio
      .getCommitFiles({ repo, sha })
      .then((f) => {
        if (!live) return
        setFiles(f)
        // Small commits open fully; larger ones list files to open one by one.
        if (f.length <= 3) setShown(new Set(f.map((x) => x.path)))
      })
      .catch((e) => live && setError(errorMessage(e)))
    return () => {
      live = false
    }
  }, [repo, sha])

  if (error) return <div className="px-4 py-3 text-[12px] text-danger">{error}</div>
  if (!files) return <div className="px-4 py-3 text-[12px] text-muted">Loading files…</div>
  const toggle = (path: string) => setShown((s) => (s.has(path) ? new Set([...s].filter((p) => p !== path)) : new Set([...s, path])))
  return (
    <div className="divide-y divide-line">
      {files.map((f) => (
        <div key={f.path}>
          <button className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-hover" onClick={() => toggle(f.path)} aria-expanded={shown.has(f.path)}>
            <svg viewBox="0 0 16 16" className={cx('size-3 shrink-0 text-muted transition', !shown.has(f.path) && '-rotate-90')} fill="currentColor">
              <path d="M4 6l4 4 4-4z" />
            </svg>
            <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
              {f.previousPath && <span className="text-muted">{f.previousPath} → </span>}
              {f.path}
            </span>
            <span className="shrink-0 font-mono text-[11.5px]">
              <span className="text-ok">+{f.additions}</span> <span className="text-danger">−{f.deletions}</span>
            </span>
          </button>
          {shown.has(f.path) && <FilePatch path={f.path} patch={f.patch} />}
        </div>
      ))}
    </div>
  )
}

function FilePatch({ path, patch }: { path: string; patch?: string }) {
  const rows = useMemo(() => (patch ? parsePatch(patch) : []), [patch])
  if (!patch) return <div className="px-4 py-2 text-[12px] text-muted">No diff to show (binary or too large).</div>
  return (
    <div className="border-t border-line">
      <StaticDiff path={path} rows={rows} sourceLength={patch.length} />
    </div>
  )
}
