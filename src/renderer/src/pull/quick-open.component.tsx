import type { PullFile } from '@shared/pull.types.ts'
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import type { RankedMatch } from '../common/fuzzy-match.util.ts'
import { FuzzyText } from '../common/fuzzy-text.component.tsx'
import { rankFiles, splitMatchedPath, stepResult } from './quick-open.util.ts'

/** Arrow keys move through the results and Enter opens the highlighted one; Escape is the dialog's own. */
function useResultKeys(count: number, setActive: (update: (active: number) => number) => void, pick: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      let step: 1 | -1 = 1
      if (event.key === 'ArrowUp') {
        step = -1
      }
      setActive((active) => stepResult(active, step, count))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick()
    }
  }
}

/** One file in the list: its name, then its folder, with the matched letters marked; ✓ when viewed. */
function ResultRow(props: { match: RankedMatch<PullFile>; active: boolean; viewed: boolean; onPick: () => void }) {
  const file = props.match.item
  const parts = splitMatchedPath(file.path, props.match.positions)
  return (
    <div
      role="option"
      tabIndex={-1}
      aria-selected={props.active}
      data-active={props.active}
      title={file.path}
      className={joinClassNames(
        'flex cursor-default items-baseline gap-2 px-3 py-1.5 text-[12.5px]',
        props.active && 'bg-accent/15 text-fg',
        !props.active && 'text-muted hover:bg-hover hover:text-fg',
      )}
      onMouseDown={(event) => {
        event.preventDefault()
        props.onPick()
      }}
    >
      <span className="shrink-0 font-mono text-fg">
        <FuzzyText text={parts.name} positions={parts.namePositions} />
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">
        <FuzzyText text={parts.folder} positions={parts.folderPositions} />
      </span>
      {Boolean(props.viewed) && <span className="shrink-0 text-ok">✓</span>}
      <span className="shrink-0 font-mono text-[11px]">
        <span className="text-ok">+{file.additions}</span> <span className="text-danger">−{file.deletions}</span>
      </span>
    </div>
  )
}

/**
 * Go to a changed file (⌘P): type part of its path, matched fuzzily and best first, then Enter. A modal <dialog>,
 * so Escape and clicks outside close it and focus comes back where it was.
 */
export function QuickOpen(props: {
  files: readonly PullFile[]
  viewed: Readonly<Record<string, string>>
  onPick: (path: string) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ranked = useMemo(() => rankFiles(props.files, query), [props.files, query])
  const listId = useId()
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new active row or result list is the trigger to scroll it into view.
  useEffect(() => {
    dialog.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, ranked])
  const pick = (match: RankedMatch<PullFile> | undefined) => {
    if (match) {
      props.onPick(match.item.path)
      props.onClose()
    }
  }
  const onKeyDown = useResultKeys(ranked.length, setActive, () => pick(ranked[active]))
  return (
    <dialog
      ref={dialog}
      aria-label="Go to a changed file"
      className="mx-auto mt-24 w-[min(640px,90vw)] overflow-hidden rounded-lg border border-line bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/40"
      onClose={props.onClose}
      onMouseDown={(event) => event.target === event.currentTarget && dialog.current?.close()}
    >
      <input
        className="w-full border-b border-line bg-transparent px-4 py-3 font-mono text-[13px] outline-none"
        placeholder="Go to a changed file…"
        aria-label="File path"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={true}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
      />
      <div id={listId} role="listbox" aria-label="Changed files" className="max-h-[50vh] overflow-y-auto py-1">
        {ranked.map((match, index) => (
          <ResultRow
            key={match.item.path}
            match={match}
            active={index === active}
            viewed={props.viewed[match.item.path] === match.item.sha}
            onPick={() => pick(match)}
          />
        ))}
        {ranked.length === 0 && <div className="px-4 py-3 text-[12.5px] text-muted">No changed file matches.</div>}
      </div>
    </dialog>
  )
}
