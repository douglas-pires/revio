import type { PullFile } from '@shared/pull.types.ts'
import { useMemo, useState } from 'react'
import type { RankedMatch } from '../common/fuzzy-match.util.ts'
import { FuzzyText } from '../common/fuzzy-text.component.tsx'
import { PickerDialog } from '../common/picker-dialog.component.tsx'
import { rankFiles, splitMatchedPath } from './quick-open.util.ts'

/** One file in the list: its name, then its folder, with the matched letters marked; ✓ when viewed. */
function FileRow({ match, viewed }: { match: RankedMatch<PullFile>; viewed: boolean }) {
  const file = match.item
  const parts = splitMatchedPath(file.path, match.positions)
  return (
    <>
      <span className="shrink-0 font-mono text-fg">
        <FuzzyText text={parts.name} positions={parts.namePositions} />
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">
        <FuzzyText text={parts.folder} positions={parts.folderPositions} />
      </span>
      {Boolean(viewed) && <span className="shrink-0 text-ok">✓</span>}
      <span className="shrink-0 font-mono text-[11px]">
        <span className="text-ok">+{file.additions}</span> <span className="text-danger">−{file.deletions}</span>
      </span>
    </>
  )
}

/** Go to a changed file: type part of its path, matched fuzzily and best first, then Enter. */
export function QuickOpen(props: {
  files: readonly PullFile[]
  viewed: Readonly<Record<string, string>>
  onPick: (path: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const ranked = useMemo(() => rankFiles(props.files, query), [props.files, query])
  return (
    <PickerDialog
      label="Go to a changed file"
      placeholder="Go to a changed file…"
      emptyText="No changed file matches."
      query={query}
      onQuery={setQuery}
      results={ranked}
      readKey={({ item }) => item.path}
      readTitle={({ item }) => item.path}
      renderRow={(match) => <FileRow match={match} viewed={props.viewed[match.item.path] === match.item.sha} />}
      onPick={({ item }) => props.onPick(item.path)}
      onClose={props.onClose}
    />
  )
}
