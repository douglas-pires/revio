import type { CommitFile, PullCommit } from '@shared/history.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { useEffect, useMemo, useState } from 'react'
import { CopyButton } from '../common/copy-button.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { ago, cx, errorMessage } from '../common/format.util.ts'
import { toggledIn, toggledOpen } from '../common/group.util.ts'
import { parsePatch } from './diff.util.ts'
import { renameTitle } from './files.util.ts'
import { StaticDiff } from './static-diff.component.tsx'

const AVATAR_PX = 24
/** Commits with this few files show every diff open; larger ones list files to open one by one. */
const OPEN_ALL_UP_TO = 3

function CommitRow({
  commit,
  index,
  repo,
  open,
  onToggle,
}: {
  commit: PullCommit
  index: number
  repo: string
  open: boolean
  onToggle: () => void
}) {
  const details = commit.message.slice(commit.headline.length).trim()
  return (
    <li
      className={cx('overflow-hidden rounded-lg border bg-panel', open && 'border-accent/50', !open && 'border-line')}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted">{index}</span>
        {Boolean(commit.authorAvatar) && (
          <img
            src={commit.authorAvatar}
            alt=""
            width={AVATAR_PX}
            height={AVATAR_PX}
            className="size-6 shrink-0 rounded-full"
          />
        )}
        {!commit.authorAvatar && <span className="size-6 shrink-0 rounded-full bg-panel-2" />}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle} aria-expanded={open}>
          <div className="truncate text-[13px] font-medium hover:underline">{commit.headline}</div>
          <div className="text-[11.5px] text-muted">
            {commit.author} committed <span title={new Date(commit.date).toLocaleString()}>{ago(commit.date)} ago</span>
          </div>
        </button>
        <CopyButton
          text={commit.sha}
          title={`Copy commit sha ${commit.sha}`}
          className="shrink-0 rounded px-1 font-mono text-[11.5px] text-muted hover:bg-hover hover:text-fg"
        >
          {commit.shortSha}
        </CopyButton>
        <button
          type="button"
          className="btn btn-ghost shrink-0 py-0 text-[12px]"
          onClick={() => globalThis.revio.openExternal(commit.url)}
        >
          GitHub ↗
        </button>
      </div>
      {Boolean(open) && (
        <div className="border-t border-line">
          {Boolean(details) && (
            <pre className="border-b border-line px-4 py-2 font-sans text-[12.5px] whitespace-pre-wrap text-muted">
              {details}
            </pre>
          )}
          <CommitFiles repo={repo} sha={commit.sha} />
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
    globalThis.revio
      .getCommitFiles({ repo, sha })
      .then((commitFiles) => {
        if (!live) {
          return
        }
        setFiles(commitFiles)
        // Small commits open fully; larger ones list files to open one by one.
        if (commitFiles.length <= OPEN_ALL_UP_TO) {
          setShown(new Set(commitFiles.map((file) => file.path)))
        }
      })
      .catch((failure) => live && setError(errorMessage(failure)))
    return () => {
      live = false
    }
  }, [repo, sha])

  if (error) {
    return <div className="px-4 py-3 text-[12px] text-danger">{error}</div>
  }
  if (!files) {
    return <div className="px-4 py-3 text-[12px] text-muted">Loading files…</div>
  }
  const toggle = (path: string) => setShown((shownPaths) => toggledIn(shownPaths, path))
  return (
    <div className="divide-y divide-line">
      {files.map((file) => (
        <div key={file.path}>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-hover"
            onClick={() => toggle(file.path)}
            aria-expanded={shown.has(file.path)}
          >
            <svg
              aria-hidden={true}
              viewBox="0 0 16 16"
              className={cx('size-3 shrink-0 text-muted transition', !shown.has(file.path) && '-rotate-90')}
              fill="currentColor"
            >
              <path d="M4 6l4 4 4-4z" />
            </svg>
            <span className="min-w-0 flex-1 truncate font-mono text-[12px]" title={renameTitle(file)}>
              {Boolean(file.previousPath) && <span className="text-muted">{file.previousPath} → </span>}
              {file.path}
            </span>
            <span className="shrink-0 font-mono text-[11.5px]">
              <span className="text-ok">+{file.additions}</span> <span className="text-danger">−{file.deletions}</span>
            </span>
          </button>
          {Boolean(shown.has(file.path)) && <FilePatch path={file.path} patch={file.patch} />}
        </div>
      ))}
    </div>
  )
}

function FilePatch({ path, patch }: { path: string; patch?: string | undefined }) {
  const rows = useMemo(() => parsePatch(patch ?? ''), [patch])
  if (!patch) {
    return <div className="px-4 py-2 text-[12px] text-muted">No diff to show (binary or too large).</div>
  }
  return (
    <div className="border-t border-line">
      <StaticDiff path={path} rows={rows} sourceLength={patch.length} />
    </div>
  )
}

/** The PR's commits, oldest first like GitHub. Expand one for its full message and the files it changed. */
export function CommitsTab({ pull, headSha }: { pull: PullRef; headSha: string }) {
  const [commits, setCommits] = useState<PullCommit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    globalThis.revio
      .getPullCommits(pull, headSha)
      .then((loaded) => live && setCommits(loaded))
      .catch((failure) => live && setError(errorMessage(failure)))
    return () => {
      live = false
    }
  }, [pull, headSha])

  if (error) {
    return (
      <div className="p-6">
        <ErrorBanner>{error}</ErrorBanner>
      </div>
    )
  }
  if (!commits) {
    return <div className="p-6 text-center text-muted">Loading commits…</div>
  }
  return (
    <ol data-commits={true} className="mx-auto max-w-5xl space-y-2 px-6 py-5">
      {commits.map((commit, index) => (
        <CommitRow
          key={commit.sha}
          commit={commit}
          index={index + 1}
          repo={pull.repo}
          open={open === commit.sha}
          onToggle={() => setOpen(toggledOpen(open, commit.sha))}
        />
      ))}
    </ol>
  )
}
