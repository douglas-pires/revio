import { type GraphRow, layoutGraph } from '@shared/commit-graph.util.ts'
import type { Branches, CiState, Commit } from '@shared/git-log.types.ts'
import { useMemo } from 'react'
import { ago, cx } from '../common/format.util.ts'
import { GraphCell } from './commit-graph.component.tsx'
import { measureGraphWidth, ROW_PX } from './graph-geometry.util.ts'
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
  const { filters } = props
  const updateFilters = (patch: Partial<LogFilters>) => props.onChange({ ...filters, ...patch })
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
      <input
        type="search"
        className="input w-56 py-1 text-[12px]"
        placeholder="Text or hash"
        aria-label="Search commit messages or a hash"
        value={filters.text}
        onChange={(event) => updateFilters({ text: event.target.value })}
      />
      <select
        className="input w-auto max-w-48 py-1 text-[12px]"
        aria-label="Branch"
        value={filters.branch}
        onChange={(event) => updateFilters({ branch: event.target.value })}
      >
        <option value="">All branches</option>
        {props.branches?.branches.map((branch) => (
          <option key={`${branch.kind}:${branch.name}`} value={branch.name}>
            {branch.name}
          </option>
        ))}
      </select>
      <input
        type="search"
        className="input w-36 py-1 text-[12px]"
        placeholder="User"
        aria-label="Author name or email"
        value={filters.author}
        onChange={(event) => updateFilters({ author: event.target.value })}
      />
      <select
        className="input w-auto py-1 text-[12px]"
        aria-label="Date"
        value={filters.sinceDays}
        onChange={(event) => updateFilters({ sinceDays: Number(event.target.value) })}
      >
        {DATE_CHOICES.map((choice) => (
          <option key={choice.days} value={choice.days}>
            {choice.label}
          </option>
        ))}
      </select>
      <input
        type="search"
        className="input w-44 py-1 font-mono text-[12px]"
        placeholder="Path"
        aria-label="Only commits touching this path"
        value={filters.path}
        onChange={(event) => updateFilters({ path: event.target.value })}
      />
    </div>
  )
}

/** Labels shown on a row before the rest fold into "+N" (all of them are in the tooltip). */
const MAX_REF_CHIPS = 2

/** Tags in amber, local branches in the accent colour, remote branches muted. */
function pickChipClass(ref: string, localBranches: ReadonlySet<string>) {
  if (ref.startsWith('tag: ')) {
    return 'bg-warn/15 text-warn'
  }
  if (localBranches.has(ref)) {
    return 'bg-accent/15 text-accent'
  }
  return 'bg-panel-2 text-muted'
}

/** Branch and tag labels on a commit, local ones stronger than remote ones; never wider than the subject. */
function RefChips({ refs, localBranches }: { refs: readonly string[]; localBranches: ReadonlySet<string> }) {
  if (refs.length === 0) {
    return null
  }
  const shownRefs = refs.slice(0, MAX_REF_CHIPS)
  const hiddenCount = refs.length - shownRefs.length
  return (
    <span className="flex max-w-[40%] min-w-0 shrink items-center gap-1 overflow-hidden" title={refs.join('\n')}>
      {shownRefs.map((ref) => (
        <span
          key={ref}
          className={cx('chip min-w-0 shrink truncate py-0 font-mono text-[10.5px]', pickChipClass(ref, localBranches))}
        >
          {ref}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="chip shrink-0 bg-panel-2 py-0 text-[10.5px] text-muted">+{hiddenCount}</span>
      )}
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

/** One commit: its slice of the graph, subject, labels, author, age and CI mark. Click to open it. */
function CommitRow(props: {
  commit: Commit
  row: GraphRow | undefined
  graphWidth: number
  localBranches: ReadonlySet<string>
  ci: CiState | undefined
  selected: boolean
  onSelect: (hash: string) => void
}) {
  const { commit } = props
  const isMerge = commit.parents.length > 1
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      // biome-ignore lint/style/noInlineStyles: rows match the graph's fixed row height.
      style={{ height: ROW_PX }}
      className={cx(
        'flex w-full cursor-default items-center gap-2 pr-3 pl-2 text-left text-[12.5px]',
        props.selected && 'bg-accent/15',
        !props.selected && 'hover:bg-hover',
      )}
      onClick={() => props.onSelect(commit.hash)}
    >
      {props.row !== undefined && <GraphCell row={props.row} width={props.graphWidth} merge={isMerge} />}
      <span className={cx('min-w-[30%] flex-1 truncate', isMerge && 'text-muted')} title={commit.subject}>
        {commit.subject}
      </span>
      <RefChips refs={commit.refs} localBranches={props.localBranches} />
      <span className="w-36 shrink-0 truncate text-muted" title={commit.authorEmail}>
        {commit.author}
      </span>
      <span className="w-24 shrink-0 text-right text-muted" title={new Date(commit.date).toLocaleString()}>
        {ago(commit.date)}
      </span>
      <CiMark state={props.ci} />
    </button>
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
  const graphWidth = measureGraphWidth(Math.max(0, ...rows.map((row) => row.width)))
  const localBranches = useMemo(
    () => new Set(props.branches?.branches.filter((branch) => branch.kind === 'local').map((branch) => branch.name)),
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
          {props.commits.map((commit, index) => (
            <li key={commit.hash}>
              <CommitRow
                commit={commit}
                row={rows[index]}
                graphWidth={graphWidth}
                localBranches={localBranches}
                ci={props.ci[commit.hash]}
                selected={commit.hash === props.selected}
                onSelect={props.onSelect}
              />
            </li>
          ))}
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
