import { type GraphRow, layoutGraph } from '@shared/commit-graph.util.ts'
import type { CiState, Commit } from '@shared/git-log.types.ts'
import { useEffect, useMemo, useRef } from 'react'
import { formatAge, joinClassNames } from '../common/format.util.ts'
import { FuzzyInput } from '../common/fuzzy-input.component.tsx'
import { matchFuzzy } from '../common/fuzzy-match.util.ts'
import { FuzzyText } from '../common/fuzzy-text.component.tsx'
import { GraphCell } from './commit-graph.component.tsx'
import { measureGraphWidth, ROW_PX } from './graph-geometry.util.ts'
import type { LogFilters } from './log-filters.types.ts'

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

/** What the filter bar suggests: authors of the commits loaded, and the PR's files and folders. */
interface FilterSuggestions {
  authors: readonly string[]
  paths: readonly string[]
}

/**
 * Text, author, date and path filters above the log, as in an IDE's log toolbar. The text filters messages as you
 * type (fuzzily); author and path suggest values fuzzily and apply once picked.
 */
function FilterBar(props: {
  filters: LogFilters
  suggestions: FilterSuggestions
  onChange: (filters: LogFilters) => void
}) {
  const { filters } = props
  const updateFilters = (patch: Partial<LogFilters>) => props.onChange({ ...filters, ...patch })
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
      <input
        type="search"
        className="input w-56 py-1 text-[12px]"
        placeholder="Message or hash"
        aria-label="Search commit messages (fuzzy) or a hash"
        value={filters.text}
        onChange={(event) => updateFilters({ text: event.target.value })}
      />
      <FuzzyInput
        className="w-44"
        placeholder="GitHub login or email"
        label="Author's GitHub login or email"
        value={filters.author}
        suggestions={props.suggestions.authors}
        onCommit={(author) => updateFilters({ author })}
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
      <FuzzyInput
        className="w-72 font-mono"
        placeholder="Path"
        label="Only commits touching this path"
        value={filters.path}
        suggestions={props.suggestions.paths}
        onCommit={(path) => updateFilters({ path })}
      />
    </div>
  )
}

/** The subject, with the letters the message search matched marked. */
function Subject({ subject, messageQuery }: { subject: string; messageQuery: string }) {
  const match = useMemo(() => matchFuzzy(messageQuery, subject), [messageQuery, subject])
  return <FuzzyText text={subject} positions={match?.positions ?? []} />
}

/** Labels shown on a row before the rest fold into "+N" (all of them are in the tooltip). */
const MAX_REF_CHIPS = 2

/** Labels on a commit, such as the PR's branch on its head; never wider than the subject. */
function RefChips({ refs }: { refs: readonly string[] }) {
  if (refs.length === 0) {
    return null
  }
  const shownRefs = refs.slice(0, MAX_REF_CHIPS)
  const hiddenCount = refs.length - shownRefs.length
  return (
    <span className="flex max-w-[40%] min-w-0 shrink items-center gap-1 overflow-hidden" title={refs.join('\n')}>
      {shownRefs.map((ref) => (
        <span key={ref} className="chip min-w-0 shrink truncate bg-accent/15 py-0 font-mono text-[10.5px] text-accent">
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
    <span className={joinClassNames('w-4 shrink-0 text-center font-semibold', look.className)} title={look.title}>
      {look.mark}
    </span>
  )
}

/** One commit: its slice of the graph, subject, labels, author, age and CI mark. Click to open it. */
function CommitRow(props: {
  commit: Commit
  row: GraphRow | undefined
  graphWidth: number
  messageQuery: string
  ci: CiState | undefined
  selected: boolean
  onSelect: (hash: string) => void
}) {
  const { commit } = props
  const isMerge = commit.parents.length > 1
  return (
    <button
      type="button"
      data-commit={commit.hash}
      aria-pressed={props.selected}
      // biome-ignore lint/style/noInlineStyles: rows match the graph's fixed row height.
      style={{ height: ROW_PX }}
      className={joinClassNames(
        'flex w-full cursor-default items-center gap-2 pr-3 pl-2 text-left text-[12.5px]',
        props.selected && 'bg-accent/15',
        !props.selected && 'hover:bg-hover',
      )}
      onClick={() => props.onSelect(commit.hash)}
    >
      {props.row !== undefined && <GraphCell row={props.row} width={props.graphWidth} merge={isMerge} />}
      <span className={joinClassNames('min-w-[30%] flex-1 truncate', isMerge && 'text-muted')} title={commit.subject}>
        <Subject subject={commit.subject} messageQuery={props.messageQuery} />
      </span>
      <RefChips refs={commit.refs} />
      <span className="w-36 shrink-0 truncate text-muted" title={commit.authorEmail}>
        {commit.author}
      </span>
      <span className="w-24 shrink-0 text-right text-muted" title={new Date(commit.date).toLocaleString()}>
        {formatAge(commit.date)}
      </span>
      <CiMark state={props.ci} />
    </button>
  )
}

/** Middle pane: filters, then the commits with their graph, labels, author, date and CI result. */
export function CommitList(props: {
  commits: readonly Commit[]
  /** The message search, for marking what it matched. */
  messageQuery: string
  filters: LogFilters
  suggestions: FilterSuggestions
  onFilters: (filters: LogFilters) => void
  ci: Record<string, CiState>
  selected: string | null
  onSelect: (hash: string) => void
  loading: boolean
  more: boolean
  onLoadMore: () => void
}) {
  const rows = useMemo(() => layoutGraph(props.commits), [props.commits])
  const scroller = useRef<HTMLDivElement>(null)
  // A commit picked from elsewhere (the Commits tab) scrolls into view.
  useEffect(() => {
    if (props.selected) {
      scroller.current?.querySelector(`[data-commit="${props.selected}"]`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [props.selected])
  const graphWidth = measureGraphWidth(Math.max(0, ...rows.map((row) => row.width)))
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <FilterBar filters={props.filters} suggestions={props.suggestions} onChange={props.onFilters} />
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
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
                messageQuery={props.messageQuery}
                ci={props.ci[commit.hash]}
                selected={commit.hash === props.selected}
                onSelect={props.onSelect}
              />
            </li>
          ))}
        </ul>
        {Boolean(props.loading) && (
          <div className="px-4 py-3 text-[12px] text-muted">Reading the history from GitHub…</div>
        )}
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
