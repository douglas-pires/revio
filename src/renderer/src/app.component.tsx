import type { Inbox as InboxData } from '@shared/inbox.types.ts'
import type { MentionsInbox } from '@shared/mention.types.ts'
import { buildPullKey } from '@shared/pull.types.ts'
// biome-ignore lint/correctness/noUnresolvedImports: @types/react declares these through its namespace, which Biome's resolver does not follow.
import { lazy, Suspense, useEffect, useState } from 'react'
import { joinClassNames } from './common/format.util.ts'
import { HistoryContext } from './common/history.context.ts'
import { MascotLoading } from './common/mascot-loading.component.tsx'
import type { OpenPull } from './common/navigation.types.ts'
import { Notice } from './common/notice.component.tsx'
import { useRouteHistory } from './common/use-route-history.hook.ts'
import { useStoredChoice } from './common/use-stored-choice.hook.ts'
import { ReviewBlockContext } from './focus/review-block.context.ts'
import { BLOCK_MINUTES, type BlockMinutes } from './focus/review-block.util.ts'
import { ReviewBlockBar } from './focus/review-block-bar.component.tsx'
import { ReviewBlockPicker } from './focus/review-block-picker.component.tsx'
import { useFocusRail } from './focus/use-focus-rail.hook.ts'
import { useReviewBlock } from './focus/use-review-block.hook.ts'
import { HighlighterContext, WorkerHighlighter } from './highlight/highlight.service.ts'
import { Inbox } from './inbox/inbox.view.tsx'
import { countPullsNeedingYou } from './my-pulls/my-pulls.util.ts'
import { AnywherePage } from './palette/anywhere-page.component.tsx'
import { Palette } from './palette/palette.component.tsx'
import { ShortcutHint } from './shortcuts/shortcut-hint.component.tsx'
import { ShortcutsContext } from './shortcuts/shortcuts.context.ts'
import { ShortcutsDialog } from './shortcuts/shortcuts-dialog.component.tsx'
import { useShortcut } from './shortcuts/use-shortcut.hook.ts'
import { useShortcutSettings } from './shortcuts/use-shortcut-settings.hook.ts'
import { UpdateBanner } from './updates/update-banner.component.tsx'
import { useUpdateStatus } from './updates/use-update-status.hook.ts'
import { useWhatsNewOnUpdate } from './whats-new/use-whats-new-on-update.hook.ts'

// The inbox is the first screen; everything else (markdown, diff, highlighting) loads when first opened.
const PullView = lazy(() => import('./pull/pull.view.tsx').then((module) => ({ default: module.PullView })))

const Guidelines = lazy(() =>
  import('./guidelines/guidelines.view.tsx').then((module) => ({ default: module.Guidelines })),
)

const MyPulls = lazy(() => import('./my-pulls/my-pulls.view.tsx').then((module) => ({ default: module.MyPulls })))

const Mentions = lazy(() => import('./mentions/mentions.view.tsx').then((module) => ({ default: module.Mentions })))

const Settings = lazy(() => import('./settings/settings.view.tsx').then((module) => ({ default: module.Settings })))

const WhatsNew = lazy(() => import('./whats-new/whats-new.view.tsx').then((module) => ({ default: module.WhatsNew })))

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
      className={joinClassNames(
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
          className={joinClassNames(
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

/** Its shortcut (⌘. unless changed) opens the settings, and from there goes back to where you were. */
function SettingsShortcut({ history }: { history: RouteHistory }) {
  useShortcut('settings', () => {
    if (history.route.view === 'settings' && history.canGoBack) {
      history.back()
    } else {
      history.go({ view: 'settings' })
    }
  })
  return null
}

/** The inbox and mentions as the main process sends them, kept current by its events. */
function useLiveData(setRoute: RouteHistory['go']) {
  const [inbox, setInbox] = useState<InboxData | null>(null)
  const [mentions, setMentions] = useState<MentionsInbox | null>(null)
  useEffect(() => {
    globalThis.revio.getInbox().then((latestInbox) => latestInbox && setInbox(latestInbox))
    globalThis.revio.getMentions().then(setMentions)
    return globalThis.revio.onEvent((event) => {
      if (event.type === 'inbox') {
        setInbox(event.inbox)
      }
      if (event.type === 'mentions') {
        setMentions(event.mentions)
      }
      if (event.type === 'open-pull') {
        setRoute({ view: 'pull', pull: event.ref })
      }
    })
  }, [setRoute])
  return { inbox, mentions }
}

/** What the Focus button does: start a block, or pause and resume the one going. */
function describeFocusButton(focused: boolean) {
  if (focused) {
    return 'Pause or resume the review block'
  }
  return 'Set time aside to review'
}

/** The counts on the rail's screens; none while a review block keeps the rail quiet. */
function countRailBadges(inbox: InboxData | null, mentions: MentionsInbox | null, quiet: boolean) {
  if (quiet) {
    return { requested: 0, needingYou: 0, newMentions: 0, stale: 0 }
  }
  return {
    requested: inbox?.requested.length ?? 0,
    needingYou: countPullsNeedingYou(inbox?.authored ?? []),
    newMentions: mentions?.mentions.filter((mention) => mention.snippets.some((snippet) => snippet.isNew)).length ?? 0,
    stale: inbox?.requested.filter((pull) => pull.stale).length ?? 0,
  }
}

/**
 * The left rail: the screens, with counts on Inbox (red when something is stale) and Mentions. `quiet` leaves the
 * counts out during a review block; `focused` marks the Focus button, which then pauses and resumes the block.
 */
function NavRail({
  history,
  inbox,
  mentions,
  quiet,
  focused,
  onFocus,
}: {
  history: RouteHistory
  inbox: InboxData | null
  mentions: MentionsInbox | null
  quiet: boolean
  focused: boolean
  onFocus: () => void
}) {
  const { route, go: setRoute } = history
  const badges = countRailBadges(inbox, mentions, quiet)
  let inboxTone: 'danger' | 'accent' = 'accent'
  if (badges.stale > 0) {
    inboxTone = 'danger'
  }
  return (
    <nav className="drag flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel pt-11 pb-3">
      <NavButton
        active={route.view === 'inbox' || route.view === 'pull'}
        label="Inbox"
        onClick={() => setRoute({ view: 'inbox' })}
        badge={badges.requested}
        badgeTone={inboxTone}
      >
        <path d="M3 13h4l2 3h6l2-3h4M3 13l3-8h12l3 8v6H3z" />
      </NavButton>
      <NavButton
        active={route.view === 'my-pulls'}
        label="My PRs"
        onClick={() => setRoute({ view: 'my-pulls' })}
        badge={badges.needingYou}
        badgeTone="danger"
      >
        <path d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 21V9a3 3 0 0 0-3-3h-4M13 3l-2 3 2 3" />
      </NavButton>
      <NavButton
        active={route.view === 'mentions'}
        label="Mentions"
        onClick={() => setRoute({ view: 'mentions' })}
        badge={badges.newMentions}
        badgeTone="accent"
      >
        <path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.6 7.2" />
      </NavButton>
      <NavButton active={route.view === 'guidelines'} label="Guides" onClick={() => setRoute({ view: 'guidelines' })}>
        <path d="M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4" />
      </NavButton>
      <div className="flex-1" />
      <ShortcutHint action="review-block" description={describeFocusButton(focused)} place="right">
        <NavButton active={focused} label="Focus" onClick={onFocus}>
          <path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2.5M10 2h4" />
        </NavButton>
      </ShortcutHint>
      <ShortcutHint action="settings" description="Settings" place="right">
        <NavButton active={route.view === 'settings'} label="Settings" onClick={() => setRoute({ view: 'settings' })}>
          <path d={SETTINGS_ICON} />
        </NavButton>
      </ShortcutHint>
    </nav>
  )
}

/** The review block, its shortcut, and the dialog that starts one with the length you pick. */
function useFocusControls() {
  const block = useReviewBlock()
  const [picking, setPicking] = useState(false)
  const [last, setLast] = useStoredChoice<`${BlockMinutes}`>(
    'revio.reviewBlockMinutes',
    BLOCK_MINUTES.map((minutes) => `${minutes}` as const),
    '45',
  )
  /** Starts a block (picking its length), or pauses and resumes the one going. */
  const pick = () => {
    if (block.focused) {
      block.togglePause()
    } else {
      setPicking(true)
    }
  }
  useShortcut('review-block', pick)
  const start = (minutes: BlockMinutes) => {
    setLast(`${minutes}`)
    block.start(minutes)
  }
  return { block, picking, setPicking, last: Number(last) as BlockMinutes, pick, start }
}

/** The picker for a new block, while open. */
function FocusPicker({ controls }: { controls: ReturnType<typeof useFocusControls> }) {
  if (!controls.picking) {
    return null
  }
  return <ReviewBlockPicker last={controls.last} onPick={controls.start} onClose={() => controls.setPicking(false)} />
}

/** The screen the route names. */
function Screen({
  history,
  inbox,
  mentions,
  inboxSearch,
  onReviewed,
}: {
  history: RouteHistory
  inbox: InboxData | null
  mentions: MentionsInbox | null
  inboxSearch: [string, (text: string) => void]
  onReviewed: () => void
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
    <Suspense fallback={<MascotLoading label="Loading…" />}>
      {route.view === 'inbox' && (
        <Inbox inbox={inbox} search={inboxSearch[0]} onSearch={inboxSearch[1]} onOpen={openPull} />
      )}
      {route.view === 'pull' && (
        <PullView
          key={buildPullKey(route.pull)}
          pull={route.pull}
          initialTarget={route.target}
          onBack={goBack}
          onReviewed={() => {
            onReviewed()
            setRoute({ view: 'inbox' })
          }}
          onEditGuidelines={(repo, path) => setRoute({ view: 'guidelines', repo, path })}
          onOpenPull={openPull}
        />
      )}
      {route.view === 'guidelines' && <Guidelines initialRepo={route.repo} initialPath={route.path} />}
      {route.view === 'my-pulls' && <MyPulls inbox={inbox} onOpen={openPull} />}
      {route.view === 'mentions' && <Mentions mentions={mentions} onOpen={openPull} />}
      {route.view === 'settings' && <Settings />}
      {route.view === 'whats-new' && <WhatsNew update={route.update} onDone={() => setRoute({ view: 'inbox' })} />}
    </Suspense>
  )
}

/** The window: the review block's strip on top, the rail (hidden while you focus), and the screen. */
function FocusLayout(props: {
  history: RouteHistory
  inbox: InboxData | null
  mentions: MentionsInbox | null
  inboxSearch: [string, (text: string) => void]
  children: React.ReactNode
}) {
  const controls = useFocusControls()
  const { block } = controls
  const rail = useFocusRail(props.history.route.view)
  const showsRail = !block.focused || rail !== 'hidden'
  return (
    <ReviewBlockContext value={block}>
      <div className="flex h-full flex-col">
        <ReviewBlockBar state={block} onAnother={controls.pick} />
        <div className="flex min-h-0 flex-1">
          {showsRail && (
            <NavRail
              history={props.history}
              inbox={props.inbox}
              mentions={props.mentions}
              quiet={block.focused && rail === 'quiet'}
              focused={block.focused}
              onFocus={controls.pick}
            />
          )}
          <main className="flex min-w-0 flex-1 flex-col">
            {props.children}
            <div className="min-h-0 flex-1">
              <Screen
                history={props.history}
                inbox={props.inbox}
                mentions={props.mentions}
                inboxSearch={props.inboxSearch}
                onReviewed={block.countReview}
              />
            </div>
          </main>
        </div>
      </div>
      <FocusPicker controls={controls} />
    </ReviewBlockContext>
  )
}

export function App() {
  const history = useRouteHistory({ view: 'inbox' })
  const { inbox, mentions } = useLiveData(history.go)
  useWhatsNewOnUpdate(history.go)
  const updateStatus = useUpdateStatus()
  const shortcuts = useShortcutSettings()
  // Lives here so the inbox search survives opening a PR and coming back.
  const inboxSearch = useState('')
  const [highlighter] = useState(() => new WorkerHighlighter())
  useEffect(() => () => highlighter.dispose(), [highlighter])
  return (
    <HighlighterContext value={highlighter}>
      <HistoryContext value={history}>
        <ShortcutsContext value={shortcuts}>
          <FocusLayout history={history} inbox={inbox} mentions={mentions} inboxSearch={inboxSearch}>
            <UpdateBanner status={updateStatus} />
          </FocusLayout>
          <SettingsShortcut history={history} />
          <AnywherePage go={history.go} />
          <Palette />
          <ShortcutsDialog />
          <Notice />
        </ShortcutsContext>
      </HistoryContext>
    </HighlighterContext>
  )
}
