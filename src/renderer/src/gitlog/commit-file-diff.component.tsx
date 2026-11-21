import { useMemo } from 'react'
import { parsePatch } from '../pull/diff.util.ts'
import { StaticDiff } from '../pull/static-diff.component.tsx'
import { useFilePatch } from './use-commit-extras.hook.ts'

/** What shows while the patch is loading, failed, or is empty (a binary file, or a mode change only). */
function DiffStatus({ patch, error }: { patch: string | null; error: string | null }) {
  if (error) {
    return <div className="p-4 text-[12px] text-danger">{error}</div>
  }
  if (patch === null) {
    return <div className="p-4 text-[12px] text-muted">Reading the diff…</div>
  }
  if (patch === '') {
    return (
      <div className="p-4 text-[12px] text-muted">
        No text changes to show (a binary file, or only its mode changed).
      </div>
    )
  }
  return null
}

/** Middle pane while a file is open: its changes in the picked commit, with the way back to the log. */
export function CommitFileDiff(props: { repo: string; hash: string; path: string; onClose: () => void }) {
  const loaded = useFilePatch(props.repo, props.hash, props.path)
  const rows = useMemo(() => parsePatch(loaded.value ?? ''), [loaded.value])
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2 text-[12px]">
        <button type="button" className="btn btn-ghost py-0" onClick={props.onClose}>
          ‹ Back to the log
        </button>
        <span className="min-w-0 truncate font-mono" title={props.path}>
          {props.path}
        </span>
        <span className="shrink-0 font-mono text-muted">{props.hash.slice(0, 10)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <DiffStatus patch={loaded.value} error={loaded.error} />
        {rows.length > 0 && <StaticDiff path={props.path} rows={rows} sourceLength={loaded.value?.length ?? 0} />}
      </div>
    </section>
  )
}
