import { summarizeAround } from '@shared/excerpt.util.ts'
import type { Mention, MentionSnippet, MentionsInbox } from '@shared/mention.types.ts'
import { useState } from 'react'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { FilterChips } from '../common/filter-chips.component.tsx'
import { ago, cx } from '../common/format.util.ts'
import { ListSkeleton } from '../common/list-skeleton.component.tsx'
import type { OpenPull, PullTarget } from '../common/navigation.types.ts'
import { RefreshControl } from '../common/refresh-control.component.tsx'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import {
  audienceCounts,
  audienceLabel,
  type MentionAudience,
  matchesAudience,
  sameAudience,
} from './mention-audience.util.ts'

const hasNew = (m: Mention) => m.snippets.some((s) => s.isNew)

/** The skeleton, the empty box, or the mentions in your filter: new first, then earlier. */
function MentionList({
  mentions,
  audience,
  onOpen,
  onMarkRead,
}: {
  mentions: MentionsInbox | null
  audience: MentionAudience
  onOpen: (m: Mention, s: MentionSnippet) => void
  onMarkRead: (m: Mention) => Promise<void>
}) {
  if (!mentions) {
    return <ListSkeleton rows={SKELETON_ROWS} rowHeight="h-24" />
  }
  if (mentions.mentions.length === 0) {
    return <EmptyState>No one mentioned you or your teams on a PR in the last {mentions.windowDays} days.</EmptyState>
  }
  const shown = mentions.mentions.filter((m) => matchesAudience(m, audience))
  return (
    <>
      <MentionSection
        title="New"
        tone="accent"
        mentions={shown.filter(hasNew)}
        viewer={mentions.viewer}
        onOpen={onOpen}
        onMarkRead={onMarkRead}
      />
      <MentionSection
        title="Earlier"
        mentions={shown.filter((m) => !hasNew(m))}
        viewer={mentions.viewer}
        onOpen={onOpen}
        onMarkRead={onMarkRead}
      />
    </>
  )
}

/** All / Me / per-team, like the inbox's "Requested from". */
function AudienceFilter(props: {
  mentions: readonly Mention[]
  active: MentionAudience
  onPick: (a: MentionAudience) => void
}) {
  const chips = audienceCounts(props.mentions).map(({ audience, count }) => ({
    key: audienceLabel(audience),
    label: audienceLabel(audience),
    count,
    active: sameAudience(audience, props.active),
    onPick: () => props.onPick(audience),
  }))
  return <FilterChips label="Mentioned" chips={chips} />
}

function MentionSection(props: {
  title: string
  tone?: 'accent' | undefined
  mentions: Mention[]
  viewer: string
  onOpen: (m: Mention, s: MentionSnippet) => void
  onMarkRead: (m: Mention) => Promise<void>
}) {
  if (props.mentions.length === 0) {
    return null
  }
  return (
    <section className="mb-6">
      <SectionHeading title={props.title} count={props.mentions.length} tone={props.tone} />
      <div className="space-y-3">
        {props.mentions.map((m) => (
          <MentionCard
            key={`${m.repo}#${m.number}`}
            mention={m}
            viewer={props.viewer}
            onOpen={props.onOpen}
            onMarkRead={props.onMarkRead}
          />
        ))}
      </div>
    </section>
  )
}

const STATE_CHIP: Record<Mention['state'], string | null> = { OPEN: null, MERGED: 'merged', CLOSED: 'closed' }

function MentionCard({
  mention: m,
  viewer,
  onOpen,
  onMarkRead,
}: {
  mention: Mention
  viewer: string
  onOpen: (m: Mention, s: MentionSnippet) => void
  onMarkRead: (m: Mention) => Promise<void>
}) {
  const state = STATE_CHIP[m.state]
  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-2 text-[12px]">
        <span className="truncate font-semibold">{m.title}</span>
        {Boolean(state) && <span className="chip bg-panel text-muted">{state}</span>}
        <span className="shrink-0 text-muted">
          {m.repo}#{m.number}
        </span>
        <div className="flex-1" />
        {Boolean(hasNew(m)) && (
          <button
            type="button"
            className="btn btn-ghost py-0 text-[11.5px]"
            title="Mark this PR's GitHub notification as read"
            onClick={() => onMarkRead(m)}
          >
            Mark read
          </button>
        )}
      </div>
      <ul>
        {m.snippets.map((s) => (
          <SnippetRow key={s.id} snippet={s} viewer={viewer} onOpen={() => onOpen(m, s)} />
        ))}
      </ul>
    </div>
  )
}

const WHERE: Record<MentionSnippet['kind'], string> = {
  description: 'in the description',
  comment: 'in a comment',
  review: 'in a review',
  'review-comment': 'on',
}

const AVATAR_PX = 24
const SKELETON_ROWS = 3
/** The window the main process looks back over, shown until the first fetch says. */
const DEFAULT_WINDOW_DAYS = 14

function openTitle(s: MentionSnippet) {
  if (s.path) {
    return 'Open the PR at this comment'
  }
  return 'Open the PR and show this comment'
}

function pathAndLine(s: MentionSnippet) {
  if (!s.line) {
    return s.path ?? ''
  }
  return `${s.path}:${s.line}`
}

/** Review comments open at that comment in the diff, with its reply box; others are quoted on the overview. */
function targetOf(s: MentionSnippet): PullTarget {
  if (!s.path) {
    return { conversation: s }
  }
  return { path: s.path, line: s.line, commentId: s.commentId ?? undefined, reply: true }
}

function SnippetRow({ snippet: s, viewer, onOpen }: { snippet: MentionSnippet; viewer: string; onOpen: () => void }) {
  return (
    <li className="group/row flex gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-hover">
      <button type="button" className="flex min-w-0 flex-1 gap-3 text-left" onClick={onOpen} title={openTitle(s)}>
        <span
          className={cx('mt-2.5 size-2 shrink-0 rounded-full', s.isNew && 'bg-accent', !s.isNew && 'bg-transparent')}
        />
        {Boolean(s.isNew) && <span className="sr-only">New:</span>}
        <img
          src={s.authorAvatar}
          alt=""
          width={AVATAR_PX}
          height={AVATAR_PX}
          className="mt-0.5 size-6 shrink-0 rounded-full bg-panel-2"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="font-medium">{s.author}</span>
            <span className="text-muted">mentioned {!s.viaTeam && 'you'}</span>
            {Boolean(s.viaTeam) && <span className="chip bg-panel-2 text-muted">@{s.viaTeam}</span>}
            <span className="text-muted">{WHERE[s.kind]}</span>
            {Boolean(s.path) && (
              <code className="truncate text-[11.5px]" title={pathAndLine(s)}>
                {pathAndLine(s)}
              </code>
            )}
          </div>
          <div className={cx('mt-0.5 line-clamp-3 text-[12.5px]', !s.isNew && 'text-muted')}>
            {summarizeAround(s.body, s.viaTeam ?? viewer)}
          </div>
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-[11.5px] text-muted">{ago(s.createdAt)}</span>
        <button
          type="button"
          className="btn btn-ghost py-0 text-[11.5px] opacity-0 group-hover/row:opacity-100"
          title="Open this comment on GitHub (Revio shows review comments, not the PR conversation)"
          onClick={() => globalThis.revio.openExternal(s.url)}
        >
          GitHub ↗
        </button>
      </div>
    </li>
  )
}

/** PRs that mention you or your teams lately, unread first. */
export function Mentions({ mentions, onOpen }: { mentions: MentionsInbox | null; onOpen: OpenPull }) {
  const [audience, setAudience] = useState<MentionAudience>({ kind: 'all' })
  const refreshAction = useAsyncAction()
  const readAction = useAsyncAction()
  const refresh = () => refreshAction.run(() => globalThis.revio.refreshMentions())
  const markRead = async (m: Mention) => {
    await readAction.run(() => globalThis.revio.markMentionRead({ repo: m.repo, number: m.number }))
  }
  /** Opening a mention reads it, as on GitHub. Review comments open at that comment in the diff; others on the overview. */
  const open = (m: Mention, s: MentionSnippet) => {
    if (s.isNew) {
      markRead(m)
    }
    onOpen(m, targetOf(s))
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Mentions"
          subtitle={`You and your teams, last ${mentions?.windowDays ?? DEFAULT_WINDOW_DAYS} days`}
          actions={<RefreshControl fetchedAt={mentions?.fetchedAt} busy={refreshAction.busy} onRefresh={refresh} />}
        />
      }
    >
      <ScreenBody>
        <ErrorBanner className="mb-4">{refreshAction.error || readAction.error || mentions?.error}</ErrorBanner>
        {Boolean(mentions?.mentions.length) && (
          <AudienceFilter mentions={mentions?.mentions ?? []} active={audience} onPick={setAudience} />
        )}
        <MentionList mentions={mentions} audience={audience} onOpen={open} onMarkRead={markRead} />
      </ScreenBody>
    </Screen>
  )
}
