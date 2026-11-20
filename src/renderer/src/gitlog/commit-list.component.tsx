import { layoutGraph } from '@shared/commit-graph.util.ts'
import type { Branches, CiState, Commit } from '@shared/git-log.types.ts'
import { useMemo } from 'react'
import { ago, cx } from '../common/format.util.ts'
import { GraphCell } from './commit-graph.component.tsx'
import { graphWidth, ROW_PX } from './graph-geometry.util.ts'
import type { LogFilters } from './use-git-log.hook.ts'

const DATE_CHOICES = [
  { days: 0, label: 'Any date' },
  { days: 1, label: 'Last 24 hours' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last year' },
] as const

const CI_LOOK: Record<CiState, { className: string; mark: string; title: string }> = {
  success: { className: 'text-ok', mark: '✓', title: 'Checks passed' },
  failure: { className: 'text-danger', mark: '✕', title: 'Checks failed' },
  pending: { className: 'text-warn', mark: '•', title: 'Checks running' },
  none: { className: 'text-transparent', mark: '·', title: '' },
}

/** Text, branch, author, date and path filters above the log, as in an IDE's log toolbar. */
function FilterBar(props: { filters: LogFilters; branches: Branches | null; onChange: (filters: LogFilters) => void }) {
  const f = props.filters
  const set = (patch: Partial<LogFilters>) => props.onChange({ ...f, ...patch })
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
      <input
        type="search"
        className="input w-56 py-1 text-[12px]"
        placeholder="Text or hash"
        aria-label="Search commit messages or a hash"
        value={f.text}
        onChange={(e) => set({ text: e.target.value })}
      />
      <select
        className="input w-auto max-w-48 py-1 text-[12px]"
        aria-label="Branch"
        value={f.branch}
        onChange={(e) => set({ branch: e.target.value })}
      >
        <option value="">All branches</option>
        {props.branches?.branches.map((b) => (
          <option key={`${b.kind}:${b.name}`} value={b.name}>
            {b.name}
          </option>
        ))}
      </select>
      <input
        type="search"
        className="input w-36 py-1 text-[12px]"
        placeholder="User"
        aria-label="Author name or email"
        value={f.author}
        onChange={(e) => set({ author: e.target.value })}
      />
      <select
        className="input w-auto py-1 text-[12px]"
        aria-label="Date"
        value={f.sinceDays}
        onChange={(e) => set({ sinceDays: Number(e.target.value) })}
      >
        {DATE_CHOICES.map((d) => (
          <option key={d.days} value={d.days}>
            {d.label}
          </option>
        ))}
      </select>
      <input
        type="search"
        className="input w-44 py-1 font-mono text-[12px]"
        placeholder="Path"
        aria-label="Only commits touching this path"
        value={f.path}
        onChange={(e) => set({ path: e.target.value })}
      />
    </div>
  )
}

/** Labels shown on a row before the rest fold into "+N" (all of them are in the tooltip). */
const MAX_REF_CHIPS = 2

function chipClass(ref: string, local: ReadonlySet<string>) {
  if (ref.startsWith('tag: ')) {
    return 'bg-warn/15 text-warn'
  }
  if (local.has(ref)) {
    return 'bg-accent/15 text-accent'
  }
  return 'bg-panel-2 text-muted'
}

/** Branch and tag labels on a commit, local ones stronger than remote ones; never wider than the subject. */
function RefChips({ refs, local }: { refs: readonly string[]; local: ReadonlySet<string> }) {
  if (refs.length === 0) {
    return null
  }
  const shown = refs.slice(0, MAX_REF_CHIPS)
  const hidden = refs.length - shown.length
  return (
    <span className="flex max-w-[40%] min-w-0 shrink items-center gap-1 overflow-hidden" title={refs.join('\n')}>
      {shown.map((r) => (
        <span key={r} className={cx('chip min-w-0 shrink truncate py-0 font-mono text-[10.5px]', chipClass(r, local))}>
          {r}
        </span>
      ))}
      {hidden > 0 && <span className="chip shrink-0 bg-panel-2 py-0 text-[10.5px] text-muted">+{hidden}</span>}
    </span>
  )
}

function CiMark({ state }: { state: CiState | undefined }) {
  const look = CI_LOOK[state ?? 'none']
  return (
    <span className={cx('w-4 shrink-0 text-center font-semibold', look.className)} title={look.title}>
      {look.mark}
    </span>
  )
}

/** Middle pane: filters, then the commits with their graph, labels, author, date and CI result. */
export function CommitList(props: {
  commits: readonly Commit[]
  branches: Branches | null
  filters: LogFilters
  onFilters: (filters: LogFilters) => void
  ci: Record<string, CiState>
  selected: string | null
  onSelect: (hash: string) => void
  loading: boolean
  more: boolean
  onLoadMore: () => void
}) {
  const rows = useMemo(() => layoutGraph(props.commits), [props.commits])
  const width = graphWidth(Math.max(0, ...rows.map((r) => r.width)))
  const local = useMemo(
    () => new Set(props.branches?.branches.filter((b) => b.kind === 'local').map((b) => b.name)),
    [props.branches],
  )
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <FilterBar filters={props.filters} branches={props.branches} onChange={props.onFilters} />
      <div className="min-h-0 flex-1 overflow-auto">
        {props.commits.length === 0 && !props.loading && (
          <div className="px-4 py-10 text-center text-muted">No commits match these filters.</div>
        )}
        <ul aria-label="Commits">
          {props.commits.map((c, i) => {
            const row = rows[i]
            return (
              <li key={c.hash}>
                <button
                  type="button"
                  aria-pressed={c.hash === props.selected}
                  // biome-ignore lint/style/noInlineStyles: rows match the graph's fixed row height.
                  style={{ height: ROW_PX }}
                  className={cx(
                    'flex w-full cursor-default items-center gap-2 pr-3 pl-2 text-left text-[12.5px]',
                    c.hash === props.selected && 'bg-accent/15',
                    c.hash !== props.selected && 'hover:bg-hover',
                  )}
                  onClick={() => props.onSelect(c.hash)}
                >
                  {row !== undefined && <GraphCell row={row} width={width} merge={c.parents.length > 1} />}
                  <span
                    className={cx('min-w-[30%] flex-1 truncate', c.parents.length > 1 && 'text-muted')}
                    title={c.subject}
                  >
                    {c.subject}
                  </span>
                  <RefChips refs={c.refs} local={local} />
                  <span className="w-36 shrink-0 truncate text-muted" title={c.authorEmail}>
                    {c.author}
                  </span>
                  <span className="w-24 shrink-0 text-right text-muted" title={new Date(c.date).toLocaleString()}>
                    {ago(c.date)}
                  </span>
                  <CiMark state={props.ci[c.hash]} />
                </button>
              </li>
            )
          })}
        </ul>
        {Boolean(props.loading) && <div className="px-4 py-3 text-[12px] text-muted">Reading the log…</div>}
        {props.more && !props.loading && (
          <div className="px-4 py-3">
            <button type="button" className="btn" onClick={props.onLoadMore}>
              Load more commits
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
