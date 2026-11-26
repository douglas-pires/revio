import type { FollowUp } from '@shared/learn.types.ts'
import type { PullDetail, PullRef } from '@shared/pull.types.ts'
import { collectLines, readMeaningfulLine } from '@shared/rewritten-lines.util.ts'
import { useCallback, useMemo, useState } from 'react'
import { type LineRow, parsePatch } from '../pull/diff.util.ts'
import { StaticDiff } from '../pull/static-diff.component.tsx'
import { useLoaded } from './use-loaded.hook.ts'

/** A day: a merged PR's diff does not change. */
const MERGED_PULL_MAX_AGE_MS = 86_400_000
/** Files shown when the two PRs share none: the fix's first ones. */
const MAX_FILES_WITHOUT_SHARED = 3

/** The files to show: those both PRs changed, else the fix's first few. */
function pickFiles(fix: FollowUp, fixDetail: PullDetail) {
  if (fix.sharedFiles.length > 0) {
    return fix.sharedFiles
  }
  return fixDetail.files.slice(0, MAX_FILES_WITHOUT_SHARED).map((file) => file.path)
}

/** One PR's diff of one file, with the rows `isMarked` picks highlighted; a note when there is none. */
function FileDiff(props: {
  title: string
  path: string
  patch: string | undefined
  isMarked: (row: LineRow) => boolean
}) {
  const rows = useMemo(() => parsePatch(props.patch ?? ''), [props.patch])
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{props.title}</div>
      {!props.patch && (
        <div className="text-[12px] text-muted">Not changed here, or no diff (binary or too large).</div>
      )}
      {Boolean(props.patch) && (
        <div className="max-h-80 overflow-auto rounded-md border border-line bg-panel">
          <StaticDiff path={props.path} rows={rows} sourceLength={props.patch?.length ?? 0} isMarked={props.isMarked} />
        </div>
      )}
    </div>
  )
}

/** One shared file: what you approved, then what the fix changed, with the lines the fix rewrote marked in both. */
function SharedFile({ path, approved, fix }: { path: string; approved: PullDetail; fix: PullDetail }) {
  const approvedPatch = approved.files.find((file) => file.path === path)?.patch
  const fixPatch = fix.files.find((file) => file.path === path)?.patch
  const added = useMemo(() => collectLines(approvedPatch ?? '', '+'), [approvedPatch])
  const removed = useMemo(() => collectLines(fixPatch ?? '', '-'), [fixPatch])
  const isRewritten = (lines: ReadonlySet<string>, kind: LineRow['kind']) => (row: LineRow) => {
    const text = readMeaningfulLine(row.text)
    return row.kind === kind && text !== null && lines.has(text)
  }
  return (
    <div className="space-y-2">
      <div className="font-mono text-[11.5px]">{path}</div>
      <FileDiff
        title={`What you approved · #${approved.number}`}
        path={path}
        patch={approvedPatch}
        isMarked={isRewritten(removed, 'add')}
      />
      <FileDiff
        title={`What the fix changed · #${fix.number}`}
        path={path}
        patch={fixPatch}
        isMarked={isRewritten(added, 'del')}
      />
    </div>
  )
}

/** Both PRs' diffs, loaded when opened. */
function LoadedDiffs({ original, fix }: { original: PullRef; fix: FollowUp }) {
  const load = useCallback(
    () =>
      Promise.all([
        globalThis.revio.getPull({ repo: original.repo, number: original.number }, MERGED_PULL_MAX_AGE_MS),
        globalThis.revio.getPull({ repo: fix.repo, number: fix.number }, MERGED_PULL_MAX_AGE_MS),
      ]),
    [original.repo, original.number, fix.repo, fix.number],
  )
  const { value, error } = useLoaded(load)
  if (error !== null) {
    return <p className="text-[12px] text-danger">{error}</p>
  }
  if (value === null) {
    return <p className="text-[12px] text-muted">Loading both diffs…</p>
  }
  const [approvedDetail, fixDetail] = value
  return (
    <div className="space-y-4">
      {fix.rewrittenLines > 0 && (
        <p className="text-[12px] text-muted">Marked: the lines you approved that the fix removed or rewrote.</p>
      )}
      {pickFiles(fix, fixDetail).map((path) => (
        <SharedFile key={path} path={path} approved={approvedDetail} fix={fixDetail} />
      ))}
    </div>
  )
}

/** "Show the code": the diffs of what you approved and what the fix changed, side by side per file, folded at first. */
export function FixDiffs({ original, fix }: { original: PullRef; fix: FollowUp }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1.5">
      <button
        type="button"
        className="btn btn-ghost px-1 py-0 text-[12px] text-muted hover:text-fg"
        onClick={() => setOpen(!open)}
      >
        {Boolean(open) && '▾ Hide the code'}
        {!open && '▸ Show the code'}
      </button>
      {Boolean(open) && (
        <div className="mt-2">
          <LoadedDiffs original={original} fix={fix} />
        </div>
      )}
    </div>
  )
}
