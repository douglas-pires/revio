import { useMemo } from 'react'
import { parsePatch, sliceAroundLine } from './diff.util'
import { StaticDiff } from './static-diff.component'

/** A few highlighted diff lines around `line`, that line marked. Renders nothing when the line is not in the diff. */
export function CodeSnippet({ path, patch, line, onOpen }: { path: string; patch: string; line: number; onOpen: () => void }) {
  const rows = useMemo(() => sliceAroundLine(parsePatch(patch), line), [patch, line])
  if (!rows.length) return null
  return (
    <button
      className="mt-2 block w-full overflow-hidden rounded-md border border-line bg-panel text-left hover:border-accent/60"
      title={`Open ${path} at line ${line}`}
      onClick={onOpen}
    >
      <StaticDiff path={path} rows={rows} sourceLength={patch.length} markLine={line} />
    </button>
  )
}
