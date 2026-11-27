import type { PullRef } from '@shared/pull.types.ts'
import type { SymbolHit, SymbolSearch } from '@shared/symbol.types.ts'
import { useEffect, useState } from 'react'
import { joinClassNames, readErrorMessage } from '../common/format.util.ts'
import { PanelHeader } from '../common/panel-header.component.tsx'
import { ResizablePanel } from '../common/resizable-panel.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'

/** A hit's lines, the hit itself marked, with line numbers. */
function HitContext({ hit }: { hit: SymbolHit }) {
  return (
    <pre className="mt-1 overflow-x-auto rounded border border-line bg-bg py-1 font-mono text-[11px] leading-[17px]">
      {hit.context.map((text, index) => {
        const line = hit.contextStart + index
        return (
          <div key={line} className={joinClassNames('flex px-2', line === hit.line && 'bg-focus/15')}>
            <span className="w-9 shrink-0 pr-2 text-right text-muted/70 select-none">{line}</span>
            <span className="whitespace-pre">{text}</span>
          </div>
        )
      })}
    </pre>
  )
}

/** What clicking a line does, by whether its file is in the PR. */
const HIT_TITLES = { true: 'Go to this line in the diff', false: 'Show the lines around it' } as const

/** One line mentioning the name: in the PR it jumps to the diff; elsewhere it opens to show the lines around it. */
function HitRow({ hit, onJump }: { hit: SymbolHit; onJump: (path: string, line: number) => void }) {
  const [open, setOpen] = useState(false)
  const choose = () => {
    if (hit.inPull) {
      onJump(hit.path, hit.line)
    } else {
      setOpen(!open)
    }
  }
  return (
    <li className="px-3 py-1">
      <button
        type="button"
        className="block w-full rounded px-1 py-0.5 text-left hover:bg-hover"
        title={HIT_TITLES[String(hit.inPull) as 'true' | 'false']}
        onClick={choose}
      >
        <span className="block truncate font-mono text-[10.5px] text-muted" title={hit.path}>
          {hit.path}:{hit.line}
        </span>
        <span className="block truncate font-mono text-[11.5px]">{hit.text.trim()}</span>
      </button>
      {Boolean(open) && <HitContext hit={hit} />}
    </li>
  )
}

/** A group of hits under its heading; nothing when empty. */
function HitGroup(props: {
  title: string
  hint?: string
  hits: readonly SymbolHit[]
  onJump: (path: string, line: number) => void
}) {
  if (props.hits.length === 0) {
    return null
  }
  return (
    <section className="mb-2">
      <SectionHeading title={props.title} count={props.hits.length} hint={props.hint} className="mb-0.5 px-3 pt-2" />
      <ul>
        {props.hits.map((hit) => (
          <HitRow key={`${hit.path}:${hit.line}`} hit={hit} onJump={props.onJump} />
        ))}
      </ul>
    </section>
  )
}

function Results({ search, onJump }: { search: SymbolSearch; onJump: (path: string, line: number) => void }) {
  const definitions = search.hits.filter((hit) => hit.kind === 'definition')
  const inPull = search.hits.filter((hit) => hit.kind === 'usage' && hit.inPull)
  const elsewhere = search.hits.filter((hit) => hit.kind === 'usage' && !hit.inPull)
  return (
    <>
      {search.note !== null && <p className="px-3 pt-2 text-[12px] text-muted">{search.note}</p>}
      {search.hits.length === 0 && <p className="px-3 py-8 text-center text-[12px] text-muted">No mentions found.</p>}
      <HitGroup title="Defined" hits={definitions} onJump={onJump} />
      <HitGroup title="Used in this PR" hits={inPull} onJump={onJump} />
      <HitGroup title="Used elsewhere" hint="at the PR’s head" hits={elsewhere} onJump={onJump} />
    </>
  )
}

/** Beside the diff: where a name is defined and used, in the PR and the rest of the repository. */
export function SymbolPanel(props: {
  pull: PullRef
  name: string
  onJump: (path: string, line: number) => void
  onClose: () => void
}) {
  const { pull, name } = props
  const [search, setSearch] = useState<SymbolSearch | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setSearch(null)
    setError(null)
    globalThis.revio
      .findSymbol(pull, name)
      .then((found) => live && setSearch(found))
      .catch((failure) => live && setError(readErrorMessage(failure)))
    return () => {
      live = false
    }
  }, [pull, name])
  return (
    <ResizablePanel
      name="symbol"
      edge="left"
      defaultWidth={384}
      minWidth={280}
      label="Resize the usages panel"
      className="flex flex-col border-l border-line bg-panel"
    >
      <PanelHeader
        title="Usages"
        detail={<span className="min-w-0 truncate font-mono text-fg">{name}</span>}
        onClose={props.onClose}
        closeLabel="Hide usages"
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {error !== null && <p className="px-3 py-4 text-[12px] text-danger">{error}</p>}
        {error === null && search === null && (
          <p className="px-3 py-8 text-center text-[12px] text-muted">Searching the PR and the repository…</p>
        )}
        {search !== null && <Results search={search} onJump={props.onJump} />}
      </div>
    </ResizablePanel>
  )
}
