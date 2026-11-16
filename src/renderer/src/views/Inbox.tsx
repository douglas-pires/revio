import { useMemo, useState } from 'react'
import type { Inbox as InboxData, PullSummary, Stack } from '@shared/types'
import { AudienceBar } from '../components/AudienceBar'
import { InboxSearch } from '../components/InboxSearch'
import { ErrorBanner } from '../components/ErrorBanner'
import { SectionHeading } from '../components/SectionHeading'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { ago, cx, duration } from '../lib/format'
import { EMPTY } from '../lib/group'
import { readAudience, isEmptyQuery, matchesQuery, parseQuery, stackPrToSearchable, summaryToSearchable, threadToSearchable, applyAudience, type InboxQuery, type ReviewAudience } from '../lib/inboxQuery'
import { usePrefetchOnHover } from '../hooks/usePrefetchOnHover'
import { useThreads } from '../hooks/useThreads'
import type { ScrollTarget } from '../hooks/useScrollToTarget'
import { ThreadList } from '../components/ThreadList'
import { countWaitingOnYou } from '../lib/threadEdits'

export function Inbox({
  inbox,
  search,
  onSearch,
  onOpen,
}: {
  inbox: InboxData | null
  search: string
  onSearch: (text: string) => void
  onOpen: (repo: string, number: number, target?: ScrollTarget) => void
}) {
  const refreshAction = useAsyncAction()
  const [mode, setMode] = useState<'queue' | 'stacks' | 'threads'>('queue')
  const threadsState = useThreads()
  const [focusStack, setFocusStack] = useState<string | null>(null)
  const openStack = (id: string) => {
    setMode('stacks')
    setFocusStack(id)
    requestAnimationFrame(() => document.getElementById(`stack-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }

  const refresh = () => refreshAction.run(() => Promise.all([window.revio.refreshInbox(), threadsState.reload()]))

  const query = useMemo(() => parseQuery(search), [search])
  const filtering = !isEmptyQuery(query)
  const { requested, reviewed, stacks } = useMemo(() => filterInbox(inbox, query), [inbox, query])
  const stale = requested.filter((p) => p.stale)
  const fresh = requested.filter((p) => !p.stale)
  const threads = useMemo(
    () => (threadsState.threads ?? EMPTY).filter((t) => !filtering || matchesQuery(threadToSearchable(t), query)),
    [threadsState.threads, query, filtering],
  )
  const waitingOnYou = countWaitingOnYou(threadsState.threads ?? EMPTY, threadsState.resolved)
  const pickAudience = (audience: ReviewAudience) => onSearch(applyAudience(search, audience))

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-12 shrink-0 items-center gap-3 border-b border-line px-5">
        <h1 className="text-[14px] font-semibold whitespace-nowrap">Review inbox</h1>
        <div className="no-drag flex rounded-md border border-line p-0.5">
          {(['queue', 'stacks', 'threads'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cx('rounded px-2.5 py-0.5 text-[12px] whitespace-nowrap', mode === m ? 'bg-hover text-fg' : 'text-muted hover:text-fg')}
            >
              {labelMode(m, inbox?.stacks.length ?? 0, waitingOnYou)}
            </button>
          ))}
        </div>
        {inbox?.viewer && <span className="whitespace-nowrap text-muted">@{inbox.viewer}</span>}
        <div className="flex-1" />
        <InboxSearch value={search} onChange={onSearch} />
        <span className="whitespace-nowrap text-muted">{inbox ? (ago(inbox.fetchedAt) === 'now' ? 'just updated' : `updated ${ago(inbox.fetchedAt)} ago`) : 'loading…'}</span>
        <button className="btn no-drag" onClick={() => void refresh()} disabled={refreshAction.busy}>
          {refreshAction.busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <ErrorBanner className="mb-4">{refreshAction.error || inbox?.error}</ErrorBanner>
        {!inbox && <Skeleton />}
        {mode === 'threads' && <ErrorBanner className="mb-4">{threadsState.error}</ErrorBanner>}
        {mode === 'threads' && !threadsState.threads && !threadsState.error && <Skeleton />}
        {mode === 'threads' && threadsState.threads && <ThreadList
            threads={threads}
            resolved={threadsState.resolved}
            filtering={filtering}
            onOpen={onOpen}
            onReply={threadsState.reply}
            onResolve={threadsState.setThreadResolved}
          />}
        {inbox && mode !== 'threads' && !!inbox.requested.length && (
          <div className="mb-4">
            <AudienceBar requested={inbox.requested} active={readAudience(query)} onPick={pickAudience} />
          </div>
        )}
        {inbox && mode === 'stacks' && <Stacks stacks={stacks} filtering={filtering} focus={focusStack} onOpen={onOpen} />}
        {inbox && mode === 'queue' && (
          <>
            <Section title="Stale" hint="waiting longer than your stale threshold" tone="danger" items={stale} onOpen={onOpen} onStack={openStack} />
            <Section
              title="Needs your review"
              items={fresh}
              onOpen={onOpen}
              onStack={openStack}
              empty={stale.length ? undefined : filtering ? 'Nothing matches this search.' : 'Nothing waiting on you. 🎉'}
            />
            <Section title="You reviewed · still open" hint="re-review when they push" items={reviewed} onOpen={onOpen} onStack={openStack} muted />
          </>
        )}
      </div>
    </div>
  )
}

function labelMode(mode: 'queue' | 'stacks' | 'threads', stacks: number, waitingOnYou: number) {
  if (mode === 'queue') return 'Queue'
  if (mode === 'stacks') return stacks ? `Stacks ${stacks}` : 'Stacks'
  return waitingOnYou ? `Threads ${waitingOnYou}` : 'Threads'
}

/** Inbox rows and stacks that match the query. A stack stays when any member matches. */
function filterInbox(inbox: InboxData | null, query: InboxQuery) {
  if (!inbox) return { requested: EMPTY, reviewed: EMPTY, stacks: EMPTY }
  if (isEmptyQuery(query)) return inbox
  const rows = new Map([...inbox.requested, ...inbox.reviewed].map((p) => [p.id, p]))
  return {
    requested: inbox.requested.filter((p) => matchesQuery(summaryToSearchable(p, true), query)),
    reviewed: inbox.reviewed.filter((p) => matchesQuery(summaryToSearchable(p, false), query)),
    stacks: inbox.stacks.filter((st) => st.nodes.some((n) => matchesQuery(stackPrToSearchable(n.pr, rows.get(n.pr.id)), query))),
  }
}

function Section(props: {
  title: string
  hint?: string
  items: readonly PullSummary[]
  onOpen: (repo: string, number: number) => void
  onStack: (id: string) => void
  tone?: 'danger'
  muted?: boolean
  empty?: string
}) {
  if (!props.items.length && !props.empty) return null
  return (
    <section className="mb-6">
      <SectionHeading title={props.title} count={props.items.length} hint={props.hint} tone={props.tone} />
      {!props.items.length ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-muted">{props.empty}</div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line bg-panel">
          {props.items.map((p) => (
            <Row key={p.id} pr={p} onOpen={props.onOpen} onStack={props.onStack} muted={props.muted} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ pr, onOpen, onStack, muted }: { pr: PullSummary; onOpen: (repo: string, number: number) => void; onStack: (id: string) => void; muted?: boolean }) {
  const prefetch = usePrefetchOnHover()
  const size = pr.additions + pr.deletions
  const sizeLabel = size < 50 ? 'XS' : size < 200 ? 'S' : size < 600 ? 'M' : size < 1500 ? 'L' : 'XL'
  return (
    <li
      {...prefetch(pr.repo, pr.number)}
      onClick={() => onOpen(pr.repo, pr.number)}
      className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-hover"
    >
      <img src={pr.authorAvatar} alt="" className="size-7 shrink-0 rounded-full bg-panel-2" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cx('truncate font-medium', muted && 'text-muted')}>{pr.title}</span>
          {pr.isDraft && <span className="chip bg-panel-2 text-muted">draft</span>}
          {pr.stack && (
            <button
              className="chip bg-accent/15 text-accent hover:bg-accent/25"
              title={`Stacked PR: ${pr.stack.position} of ${pr.stack.size} from the bottom. Click to see the stack.`}
              onClick={(e) => {
                e.stopPropagation()
                onStack(pr.stack!.id)
              }}
            >
              ⧉ stack {pr.stack.position}/{pr.stack.size}
            </button>
          )}
          {pr.viaTeam && <span className="chip bg-panel-2 text-muted">@{pr.viaTeam}</span>}
          {pr.reviewDecision === 'CHANGES_REQUESTED' && <span className="chip bg-danger/15 text-danger">changes requested</span>}
          {pr.reviewDecision === 'APPROVED' && <span className="chip bg-ok/15 text-ok">approved</span>}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted">
          {pr.repo}#{pr.number} · {pr.author} · {pr.headRef} → {pr.baseRef}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 font-mono text-[11.5px]">
        <span className="text-muted" title={`${pr.changedFiles} files`}>
          {pr.changedFiles}f
        </span>
        <span>
          <span className="text-ok">+{pr.additions}</span> <span className="text-danger">−{pr.deletions}</span>
        </span>
        <span className="chip w-7 justify-center bg-panel-2 text-muted">{sizeLabel}</span>
        {!muted && (
          <span
            className={cx('w-12 text-right', pr.stale ? 'font-semibold text-danger' : 'text-muted')}
            title={pr.requestedAt ? `requested ${new Date(pr.requestedAt).toLocaleString()}` : 'request time unknown'}
          >
            {duration(pr.waitingHours)}
          </span>
        )}
        {muted && <span className="w-12 text-right text-muted">{ago(pr.updatedAt)}</span>}
      </div>
    </li>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-panel" />
      ))}
    </div>
  )
}

function Stacks({ stacks, filtering, focus, onOpen }: { stacks: readonly Stack[]; filtering: boolean; focus: string | null; onOpen: (repo: string, number: number) => void }) {
  const prefetch = usePrefetchOnHover()
  if (!stacks.length)
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-muted">
        {filtering ? 'No stack has a PR matching this search.' : 'None of the PRs in your inbox are stacked. A stack is a PR whose base branch is another open PR’s branch.'}
      </div>
    )
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted">
        Stacks read bottom-up: review the PR closest to <code>{stacks[0]?.base ?? 'main'}</code> first, since everything above builds on it.
      </p>
      {stacks.map((st) => {
        const waiting = st.nodes.filter((n) => n.pr.inbox === 'requested').length
        return (
          <section
            key={st.id}
            id={`stack-${st.id}`}
            className={cx('overflow-hidden rounded-lg border bg-panel', focus === st.id ? 'border-accent ring-1 ring-accent/40' : 'border-line')}
          >
            <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-2 text-[12px]">
              <span className="font-semibold">{st.repo}</span>
              <span className="text-muted">
                {st.nodes.length} PRs on <code className="text-fg">{st.base}</code>
              </span>
              <div className="flex-1" />
              {waiting > 0 && <span className="chip bg-accent/15 text-accent">{waiting} waiting on you</span>}
            </header>
            <ol>
              {st.nodes.map(({ pr, depth }, i) => (
                <li
                  key={pr.id}
                  {...prefetch(pr.repo, pr.number)}
                  onClick={() => onOpen(pr.repo, pr.number)}
                  className={cx('flex cursor-pointer items-center gap-3 border-b border-line py-2 pr-4 last:border-b-0 hover:bg-hover', !pr.inbox && 'opacity-70')}
                  style={{ paddingLeft: 12 + depth * 20 }}
                >
                  <span className="w-4 shrink-0 text-center font-mono text-muted" aria-hidden>
                    {depth > 0 ? '↳' : ''}
                  </span>
                  <span
                    title={pr.inbox === 'requested' ? 'Waiting on your review' : pr.reviewDecision === 'APPROVED' ? 'Approved' : ''}
                    className={cx(
                      'size-2.5 shrink-0 rounded-full border-2',
                      pr.inbox === 'requested' ? (pr.stale ? 'border-danger bg-danger' : 'border-accent bg-accent') : pr.reviewDecision === 'APPROVED' ? 'border-ok bg-ok' : 'border-muted',
                    )}
                  />
                  <img src={pr.authorAvatar} alt="" className="size-6 shrink-0 rounded-full bg-panel-2" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{pr.title}</span>
                      {pr.isDraft && <span className="chip bg-panel-2 text-muted">draft</span>}
                      {pr.inbox === 'requested' && <span className={cx('chip', pr.stale ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent')}>{pr.stale ? 'stale · needs you' : 'needs your review'}</span>}
                      {pr.inbox === 'reviewed' && <span className="chip bg-panel-2 text-muted">you reviewed</span>}
                      {!pr.inbox && <span className="chip bg-panel-2 text-muted">not requested</span>}
                      {pr.reviewDecision === 'APPROVED' && <span className="chip bg-ok/15 text-ok">approved</span>}
                      {pr.reviewDecision === 'CHANGES_REQUESTED' && <span className="chip bg-danger/15 text-danger">changes requested</span>}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11.5px] text-muted">
                      #{pr.number} · {pr.author} · {pr.headRef} → {pr.baseRef}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted">{i + 1}</span>
                </li>
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
