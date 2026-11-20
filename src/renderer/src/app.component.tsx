import type { Inbox as InboxData } from '@shared/inbox.types.ts'
import type { MentionsInbox } from '@shared/mention.types.ts'
import { pullKey } from '@shared/pull.types.ts'
// biome-ignore lint/correctness/noUnresolvedImports: @types/react declares these through its namespace, which Biome's resolver does not follow.
import { lazy, Suspense, useEffect, useState } from 'react'
import { cx } from './common/format.util.ts'
import { HistoryContext } from './common/history.context.ts'
import type { OpenPull } from './common/navigation.types.ts'
import { useRouteHistory } from './common/use-route-history.hook.ts'
import { HighlighterContext, WorkerHighlighter } from './highlight/highlight.service.ts'
import { Inbox } from './inbox/inbox.view.tsx'
import { UpdateBanner } from './updates/update-banner.component.tsx'
import { useUpdateStatus } from './updates/use-update-status.hook.ts'

// The inbox is the first screen; everything else (markdown, diff, highlighting) loads when first opened.
const PullView = lazy(() => import('./pull/pull.view.tsx').then((m) => ({ default: m.PullView })))

const Guidelines = lazy(() => import('./guidelines/guidelines.view.tsx').then((m) => ({ default: m.Guidelines })))

const Mentions = lazy(() => import('./mentions/mentions.view.tsx').then((m) => ({ default: m.Mentions })))

const Settings = lazy(() => import('./settings/settings.view.tsx').then((m) => ({ default: m.Settings })))

function NavButton(props: {
  active: boolean
  label: string
  onClick: () => void
  badge?: number | undefined
  badgeTone?: 'accent' | 'danger'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        'no-drag relative flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10.5px] transition',
        props.active && 'bg-hover text-fg',
        !props.active && 'text-muted hover:bg-hover/60 hover:text-fg',
      )}
    >
      <svg
        aria-hidden={true}
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {props.children}
      </svg>
      {props.label}
      {Boolean(props.badge) && (
        <span
          className={cx(
            'absolute top-1 right-2 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white',
            props.badgeTone === 'danger' && 'bg-danger',
            !(props.badgeTone === 'danger') && 'bg-accent',
          )}
        >
          {props.badge}
        </span>
      )}
    </button>
  )
}

const SETTINGS_ICON =
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'

type RouteHistory = ReturnType<typeof useRouteHistory>

/** The inbox and mentions as the main process sends them, kept current by its events. */
function useLiveData(setRoute: RouteHistory['go']) {
  const [inbox, setInbox] = useState<InboxData | null>(null)
  const [mentions, setMentions] = useState<MentionsInbox | null>(null)
  useEffect(() => {
    globalThis.revio.getInbox().then((i) => i && setInbox(i))
    globalThis.revio.getMentions().then(setMentions)
    return globalThis.revio.onEvent((e) => {
      if (e.type === 'inbox') {
        setInbox(e.inbox)
      }
      if (e.type === 'mentions') {
        setMentions(e.mentions)
      }
      if (e.type === 'open-pull') {
        setRoute({ view: 'pull', pull: e.ref })
      }
    })
  }, [setRoute])
  return { inbox, mentions }
}

/** The left rail: the screens, with counts on Inbox (red when something is stale) and Mentions. */
function NavRail({
  history,
  inbox,
  mentions,
}: {
  history: RouteHistory
  inbox: InboxData | null
  mentions: MentionsInbox | null
}) {
  const { route, go: setRoute } = history
  const staleCount = inbox?.requested.filter((p) => p.stale).length ?? 0
  const newMentions = mentions?.mentions.filter((m) => m.snippets.some((s) => s.isNew)).length ?? 0
  let inboxTone: 'danger' | 'accent' = 'accent'
  if (staleCount > 0) {
    inboxTone = 'danger'
  }
  return (
    <nav className="drag flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel pt-11 pb-3">
      <NavButton
        active={route.view === 'inbox' || route.view === 'pull'}
        label="Inbox"
        onClick={() => setRoute({ view: 'inbox' })}
        badge={inbox?.requested.length}
        badgeTone={inboxTone}
      >
        <path d="M3 13h4l2 3h6l2-3h4M3 13l3-8h12l3 8v6H3z" />
      </NavButton>
      <NavButton
        active={route.view === 'mentions'}
        label="Mentions"
        onClick={() => setRoute({ view: 'mentions' })}
        badge={newMentions}
        badgeTone="accent"
      >
        <path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.6 7.2" />
      </NavButton>
      <NavButton active={route.view === 'guidelines'} label="Guides" onClick={() => setRoute({ view: 'guidelines' })}>
        <path d="M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4" />
      </NavButton>
      <div className="flex-1" />
      <NavButton active={route.view === 'settings'} label="Settings" onClick={() => setRoute({ view: 'settings' })}>
        <path d={SETTINGS_ICON} />
      </NavButton>
    </nav>
  )
}

/** The screen the route names. */
function Screen({
  history,
  inbox,
  mentions,
  inboxSearch,
}: {
  history: RouteHistory
  inbox: InboxData | null
  mentions: MentionsInbox | null
  inboxSearch: [string, (text: string) => void]
}) {
  const { route, go: setRoute } = history
  const openPull: OpenPull = (pull, target) =>
    setRoute({ view: 'pull', pull: { repo: pull.repo, number: pull.number }, target })
  const goBack = () => {
    if (history.canGoBack) {
      history.back()
    } else {
      setRoute({ view: 'inbox' })
    }
  }
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-muted">Loading…</div>}>
      {route.view === 'inbox' && (
        <Inbox inbox={inbox} search={inboxSearch[0]} onSearch={inboxSearch[1]} onOpen={openPull} />
      )}
      {route.view === 'pull' && (
        <PullView
          key={pullKey(route.pull)}
          pull={route.pull}
          initialTarget={route.target}
          onBack={goBack}
          onReviewed={() => setRoute({ view: 'inbox' })}
          onEditGuidelines={(repo, path) => setRoute({ view: 'guidelines', repo, path })}
          onOpenPull={openPull}
        />
      )}
      {route.view === 'guidelines' && <Guidelines initialRepo={route.repo} initialPath={route.path} />}
      {route.view === 'mentions' && <Mentions mentions={mentions} onOpen={openPull} />}
      {route.view === 'settings' && <Settings />}
    </Suspense>
  )
}

export function App() {
  const history = useRouteHistory({ view: 'inbox' })
  const { inbox, mentions } = useLiveData(history.go)
  const updateStatus = useUpdateStatus()
  // Lives here so the inbox search survives opening a PR and coming back.
  const inboxSearch = useState('')
  const [highlighter] = useState(() => new WorkerHighlighter())
  useEffect(() => () => highlighter.dispose(), [highlighter])
  return (
    <HighlighterContext value={highlighter}>
      <HistoryContext value={history}>
        <div className="flex h-full">
          <NavRail history={history} inbox={inbox} mentions={mentions} />
          <main className="flex min-w-0 flex-1 flex-col">
            <UpdateBanner status={updateStatus} />
            <div className="min-h-0 flex-1">
              <Screen history={history} inbox={inbox} mentions={mentions} inboxSearch={inboxSearch} />
            </div>
          </main>
        </div>
      </HistoryContext>
    </HighlighterContext>
  )
}
