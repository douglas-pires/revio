import type { Inbox as InboxData, PullSummary } from '@shared/inbox.types.ts'
import { useMemo, useState } from 'react'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { cx, describeFreshness } from '../common/format.util.ts'
import { EMPTY } from '../common/group.util.ts'
import type { OpenPull } from '../common/navigation.types.ts'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { countWaitingOnYou } from '../threads/thread-edits.util.ts'
import { ThreadList } from '../threads/thread-list.component.tsx'
import { useThreads } from '../threads/use-threads.hook.ts'
import { AudienceBar } from './audience-bar.component.tsx'
import {
  applyAudience,
  type InboxQuery,
  isEmptyQuery,
  matchesQuery,
  parseQuery,
  type ReviewAudience,
  readAudience,
  stackPrToSearchable,
  summaryToSearchable,
  threadToSearchable,
} from './inbox-query.util.ts'
import { InboxRow } from './inbox-row.component.tsx'
import { InboxSearch } from './inbox-search.component.tsx'
import { StackList } from './stack-list.component.tsx'

type Mode = 'queue' | 'stacks' | 'threads'

/** Placeholder rows while the inbox loads. */
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

function ModeSwitch({
  mode,
  labels,
  onChange,
}: {
  mode: Mode
  labels: { stacks: number; waitingOnYou: number }
  onChange: (mode: Mode) => void
}) {
  return (
    <div className="no-drag flex rounded-md border border-line p-0.5">
      {(['queue', 'stacks', 'threads'] as const).map((m) => (
        <button
          type="button"
          key={m}
          onClick={() => onChange(m)}
          className={cx(
            'rounded px-2.5 py-0.5 text-[12px] whitespace-nowrap',
            mode === m && 'bg-hover text-fg',
            mode !== m && 'text-muted hover:text-fg',
          )}
        >
          {labelMode(m, labels.stacks, labels.waitingOnYou)}
        </button>
      ))}
    </div>
  )
}

function ThreadsMode({
  state,
  query,
  filtering,
  onOpen,
}: {
  state: ReturnType<typeof useThreads>
  query: InboxQuery
  filtering: boolean
  onOpen: OpenPull
}) {
  const threads = useMemo(
    () => (state.threads ?? EMPTY).filter((t) => !filtering || matchesQuery(threadToSearchable(t), query)),
    [state.threads, query, filtering],
  )
  return (
    <>
      <ErrorBanner className="mb-4">{state.error}</ErrorBanner>
      {Boolean(state.threads) && (
        <ThreadList
          threads={threads}
          resolved={state.resolved}
          filtering={filtering}
          onOpen={onOpen}
          onReply={state.reply}
          onResolve={state.setThreadResolved}
        />
      )}
      {!(state.threads || state.error) && <Skeleton />}
    </>
  )
}

/** The Queue and Stacks views: who asked, then your requests or the stacks they belong to. */
function PullsMode(props: {
  mode: 'queue' | 'stacks'
  inbox: InboxData | null
  query: InboxQuery
  filtering: boolean
  focusStack: string | null
  onAudience: (audience: ReviewAudience) => void
  onOpen: OpenPull
  onStack: (id: string) => void
}) {
  const { requested, reviewed, stacks } = useMemo(
    () => filterInbox(props.inbox, props.query),
    [props.inbox, props.query],
  )
  if (!props.inbox) {
    return <Skeleton />
  }
  return (
    <>
      {props.inbox.requested.length > 0 && (
        <div className="mb-4">
          <AudienceBar requested={props.inbox.requested} active={readAudience(props.query)} onPick={props.onAudience} />
        </div>
      )}
      {props.mode === 'stacks' && (
        <StackList stacks={stacks} filtering={props.filtering} focus={props.focusStack} onOpen={props.onOpen} />
      )}
      {props.mode !== 'stacks' && (
        <QueueSections
          requested={requested}
          reviewed={reviewed}
          filtering={props.filtering}
          onOpen={props.onOpen}
          onStack={props.onStack}
        />
      )}
    </>
  )
}

function QueueSections(props: {
  requested: readonly PullSummary[]
  reviewed: readonly PullSummary[]
  filtering: boolean
  onOpen: OpenPull
  onStack: (id: string) => void
}) {
  const stale = props.requested.filter((p) => p.stale)
  const fresh = props.requested.filter((p) => !p.stale)
  const empty = emptyQueueText(stale.length > 0, props.filtering)
  return (
    <>
      <Section
        title="Stale"
        hint="waiting longer than your stale threshold"
        tone="danger"
        items={stale}
        onOpen={props.onOpen}
        onStack={props.onStack}
      />
      <Section title="Needs your review" items={fresh} onOpen={props.onOpen} onStack={props.onStack} empty={empty} />
      <Section
        title="You reviewed · still open"
        hint="re-review when they push"
        items={props.reviewed}
        onOpen={props.onOpen}
        onStack={props.onStack}
        muted={true}
      />
    </>
  )
}

function labelMode(mode: Mode, stacks: number, waitingOnYou: number) {
  if (mode === 'queue') {
    return 'Queue'
  }
  if (mode === 'stacks') {
    return withCount('Stacks', stacks)
  }
  return withCount('Threads', waitingOnYou)
}

/** A label with its count, or the bare label when there are none. */
function withCount(label: string, count: number) {
  if (count === 0) {
    return label
  }
  return `${label} ${count}`
}

/** What "Needs your review" says when it is empty; nothing while stale PRs show above it. */
function emptyQueueText(hasStale: boolean, filtering: boolean) {
  if (hasStale) {
    return
  }
  if (filtering) {
    return 'Nothing matches this search.'
  }
  return 'Nothing waiting on you. 🎉'
}

/** Inbox rows and stacks that match the query. A stack stays when any member matches. */
function filterInbox(inbox: InboxData | null, query: InboxQuery) {
  if (!inbox) {
    return { requested: EMPTY, reviewed: EMPTY, stacks: EMPTY }
  }
  if (isEmptyQuery(query)) {
    return inbox
  }
  const rows = new Map([...inbox.requested, ...inbox.reviewed].map((p) => [p.id, p]))
  return {
    requested: inbox.requested.filter((p) => matchesQuery(summaryToSearchable(p, true), query)),
    reviewed: inbox.reviewed.filter((p) => matchesQuery(summaryToSearchable(p, false), query)),
    stacks: inbox.stacks.filter((st) =>
      st.nodes.some((n) => matchesQuery(stackPrToSearchable(n.pr, rows.get(n.pr.id)), query)),
    ),
  }
}

function Section(props: {
  title: string
  hint?: string | undefined
  items: readonly PullSummary[]
  onOpen: OpenPull
  onStack: (id: string) => void
  tone?: 'danger' | undefined
  muted?: boolean | undefined
  empty?: string | undefined
}) {
  if (!(props.items.length > 0 || props.empty)) {
    return null
  }
  return (
    <section className="mb-6">
      <SectionHeading title={props.title} count={props.items.length} hint={props.hint} tone={props.tone} />
      {props.items.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-line bg-panel">
          {props.items.map((p) => (
            <InboxRow key={p.id} pr={p} onOpen={props.onOpen} onStack={props.onStack} muted={props.muted} />
          ))}
        </ul>
      )}
      {props.items.length === 0 && (
        <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-muted">
          {props.empty}
        </div>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {SKELETON_ROWS.map((row) => (
        <div key={row} className="h-14 animate-pulse rounded-lg bg-panel" />
      ))}
    </div>
  )
}

export function Inbox({
  inbox,
  search,
  onSearch,
  onOpen,
}: {
  inbox: InboxData | null
  search: string
  onSearch: (text: string) => void
  onOpen: OpenPull
}) {
  const [mode, setMode] = useState<Mode>('queue')
  const [focusStack, setFocusStack] = useState<string | null>(null)
  const threadsState = useThreads()
  const refreshAction = useAsyncAction()
  const query = useMemo(() => parseQuery(search), [search])
  const filtering = !isEmptyQuery(query)

  const openStack = (id: string) => {
    setMode('stacks')
    setFocusStack(id)
    requestAnimationFrame(() =>
      document.querySelector(`#${CSS.escape(`stack-${id}`)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    )
  }
  const refresh = () => refreshAction.run(() => Promise.all([globalThis.revio.refreshInbox(), threadsState.reload()]))
  const labels = {
    stacks: inbox?.stacks.length ?? 0,
    waitingOnYou: countWaitingOnYou(threadsState.threads ?? EMPTY, threadsState.resolved),
  }

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-12 shrink-0 items-center gap-3 border-b border-line px-5">
        <h1 className="text-[14px] font-semibold whitespace-nowrap">Review inbox</h1>
        <ModeSwitch mode={mode} labels={labels} onChange={setMode} />
        {Boolean(inbox?.viewer) && <span className="whitespace-nowrap text-muted">@{inbox?.viewer}</span>}
        <div className="flex-1" />
        <InboxSearch value={search} onChange={onSearch} />
        <span className="whitespace-nowrap text-muted">{describeFreshness(inbox?.fetchedAt)}</span>
        <button type="button" className="btn no-drag" onClick={() => refresh()} disabled={refreshAction.busy}>
          {Boolean(refreshAction.busy) && 'Refreshing…'}
          {!refreshAction.busy && 'Refresh'}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <ErrorBanner className="mb-4">{refreshAction.error || inbox?.error}</ErrorBanner>
        {mode === 'threads' && <ThreadsMode state={threadsState} query={query} filtering={filtering} onOpen={onOpen} />}
        {mode !== 'threads' && (
          <PullsMode
            mode={mode}
            inbox={inbox}
            query={query}
            filtering={filtering}
            focusStack={focusStack}
            onAudience={(a) => onSearch(applyAudience(search, a))}
            onOpen={onOpen}
            onStack={openStack}
          />
        )}
      </div>
    </div>
  )
}
