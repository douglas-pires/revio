import type { Inbox as InboxData, PullSummary } from '@shared/inbox.types.ts'
import { useMemo, useState } from 'react'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { EMPTY } from '../common/group.util.ts'
import { ListSkeleton } from '../common/list-skeleton.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { RefreshControl } from '../common/refresh-control.component.tsx'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
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
const SKELETON_ROWS = 5

function ModeSwitch({
  mode,
  labels,
  onChange,
}: {
  mode: Mode
  labels: { stacks: number; waitingOnYou: number }
  onChange: (mode: Mode) => void
}) {
  const segments = (['queue', 'stacks', 'threads'] as const).map((segmentMode) => ({
    value: segmentMode,
    label: labelMode(segmentMode, labels.stacks, labels.waitingOnYou),
  }))
  return <SegmentedControl segments={segments} value={mode} onChange={onChange} />
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
    () => (state.threads ?? EMPTY).filter((thread) => !filtering || matchesQuery(threadToSearchable(thread), query)),
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
      {!(state.threads || state.error) && <ListSkeleton rows={SKELETON_ROWS} />}
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
    return <ListSkeleton rows={SKELETON_ROWS} />
  }
  return (
    <>
      {props.inbox.requested.length > 0 && (
        <AudienceBar requested={props.inbox.requested} active={readAudience(props.query)} onPick={props.onAudience} />
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
  const stale = props.requested.filter((pull) => pull.stale)
  const fresh = props.requested.filter((pull) => !pull.stale)
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
  const rows = new Map([...inbox.requested, ...inbox.reviewed].map((pull) => [pull.id, pull]))
  return {
    requested: inbox.requested.filter((pull) => matchesQuery(summaryToSearchable(pull, true), query)),
    reviewed: inbox.reviewed.filter((pull) => matchesQuery(summaryToSearchable(pull, false), query)),
    stacks: inbox.stacks.filter((st) =>
      st.nodes.some((node) => matchesQuery(stackPrToSearchable(node.pr, rows.get(node.pr.id)), query)),
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
        <ul className="card">
          {props.items.map((pull) => (
            <InboxRow key={pull.id} pr={pull} onOpen={props.onOpen} onStack={props.onStack} muted={props.muted} />
          ))}
        </ul>
      )}
      {props.items.length === 0 && <EmptyState>{props.empty}</EmptyState>}
    </section>
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
    <Screen
      header={
        <ScreenHeader
          title="Review inbox"
          subtitle={inbox?.viewer && `@${inbox.viewer}`}
          actions={
            <>
              <InboxSearch value={search} onChange={onSearch} />
              <RefreshControl fetchedAt={inbox?.fetchedAt} busy={refreshAction.busy} onRefresh={refresh} />
            </>
          }
        >
          <ModeSwitch mode={mode} labels={labels} onChange={setMode} />
        </ScreenHeader>
      }
    >
      <ScreenBody>
        <ErrorBanner className="mb-4">{refreshAction.error || inbox?.error}</ErrorBanner>
        {mode === 'threads' && <ThreadsMode state={threadsState} query={query} filtering={filtering} onOpen={onOpen} />}
        {mode !== 'threads' && (
          <PullsMode
            mode={mode}
            inbox={inbox}
            query={query}
            filtering={filtering}
            focusStack={focusStack}
            onAudience={(audience) => onSearch(applyAudience(search, audience))}
            onOpen={onOpen}
            onStack={openStack}
          />
        )}
      </ScreenBody>
    </Screen>
  )
}
