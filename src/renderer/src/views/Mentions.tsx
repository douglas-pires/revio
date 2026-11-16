import type { Mention, MentionSnippet, MentionsInbox } from '@shared/types'
import { summarizeAround } from '@shared/excerpt'
import type { ScrollTarget } from '../hooks/useScrollToTarget'
import { ErrorBanner } from '../components/ErrorBanner'
import { SectionHeading } from '../components/SectionHeading'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { ago, cx } from '../lib/format'

type OpenAt = (repo: string, number: number, target?: ScrollTarget) => void

const hasNew = (m: Mention) => m.snippets.some((s) => s.isNew)

/** PRs that mention you or your teams lately, unread first. */
export function Mentions({ mentions, onOpen }: { mentions: MentionsInbox | null; onOpen: OpenAt }) {
  const refreshAction = useAsyncAction()
  const readAction = useAsyncAction()
  const refresh = () => refreshAction.run(() => window.revio.refreshMentions())
  const markRead = async (m: Mention) => {
    await readAction.run(() => window.revio.markMentionRead(m.repo, m.number))
  }
  /** Opening a mention reads it, as on GitHub. Review comments open at their line. */
  const open = (m: Mention, s: MentionSnippet) => {
    if (s.isNew) void markRead(m)
    onOpen(m.repo, m.number, s.path ? { path: s.path, line: s.line } : undefined)
  }

  const fresh = mentions?.mentions.filter(hasNew) ?? []
  const earlier = mentions?.mentions.filter((m) => !hasNew(m)) ?? []

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-12 shrink-0 items-center gap-3 border-b border-line px-5">
        <h1 className="text-[14px] font-semibold">Mentions</h1>
        <span className="text-muted">you and your teams, last {mentions?.windowDays ?? 14} days</span>
        <div className="flex-1" />
        <span className="whitespace-nowrap text-muted">{mentions ? `updated ${ago(mentions.fetchedAt) === 'now' ? 'just now' : `${ago(mentions.fetchedAt)} ago`}` : 'loading…'}</span>
        <button className="btn no-drag" onClick={() => void refresh()} disabled={refreshAction.busy}>
          {refreshAction.busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <ErrorBanner className="mb-4">{refreshAction.error || readAction.error || mentions?.error}</ErrorBanner>
        {!mentions && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-panel" />)}</div>}
        {mentions && !mentions.mentions.length && (
          <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-muted">No one mentioned you or your teams on a PR in the last {mentions.windowDays} days.</div>
        )}
        <MentionSection title="New" tone="accent" mentions={fresh} viewer={mentions?.viewer ?? ''} onOpen={open} onMarkRead={markRead} />
        <MentionSection title="Earlier" mentions={earlier} viewer={mentions?.viewer ?? ''} onOpen={open} onMarkRead={markRead} />
      </div>
    </div>
  )
}

function MentionSection(props: {
  title: string
  tone?: 'accent'
  mentions: Mention[]
  viewer: string
  onOpen: (m: Mention, s: MentionSnippet) => void
  onMarkRead: (m: Mention) => Promise<void>
}) {
  if (!props.mentions.length) return null
  return (
    <section className="mb-6">
      <SectionHeading title={props.title} count={props.mentions.length} tone={props.tone} />
      <div className="space-y-3">
        {props.mentions.map((m) => (
          <MentionCard key={`${m.repo}#${m.number}`} mention={m} viewer={props.viewer} onOpen={props.onOpen} onMarkRead={props.onMarkRead} />
        ))}
      </div>
    </section>
  )
}

const STATE_CHIP: Record<Mention['state'], string | null> = { OPEN: null, MERGED: 'merged', CLOSED: 'closed' }

function MentionCard({ mention: m, viewer, onOpen, onMarkRead }: { mention: Mention; viewer: string; onOpen: (m: Mention, s: MentionSnippet) => void; onMarkRead: (m: Mention) => Promise<void> }) {
  const state = STATE_CHIP[m.state]
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-2 text-[12px]">
        <span className="truncate font-semibold">{m.title}</span>
        {state && <span className="chip bg-panel text-muted">{state}</span>}
        <span className="shrink-0 text-muted">
          {m.repo}#{m.number}
        </span>
        <div className="flex-1" />
        {hasNew(m) && (
          <button className="btn btn-ghost py-0 text-[11.5px]" title="Mark this PR's GitHub notification as read" onClick={() => void onMarkRead(m)}>
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

function SnippetRow({ snippet: s, viewer, onOpen }: { snippet: MentionSnippet; viewer: string; onOpen: () => void }) {
  return (
    <li className="group/row flex gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-hover">
      <button className="flex min-w-0 flex-1 gap-3 text-left" onClick={onOpen} title={s.path ? 'Open the PR at this line' : 'Open the PR'}>
        <span className={cx('mt-2.5 size-2 shrink-0 rounded-full', s.isNew ? 'bg-accent' : 'bg-transparent')} aria-label={s.isNew ? 'new' : undefined} />
        <img src={s.authorAvatar} alt="" className="mt-0.5 size-6 shrink-0 rounded-full bg-panel-2" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="font-medium">{s.author}</span>
            <span className="text-muted">mentioned {s.viaTeam ? '' : 'you'}</span>
            {s.viaTeam && <span className="chip bg-panel-2 text-muted">@{s.viaTeam}</span>}
            <span className="text-muted">{WHERE[s.kind]}</span>
            {s.path && (
              <code className="truncate text-[11.5px]">
                {s.path}
                {s.line ? `:${s.line}` : ''}
              </code>
            )}
          </div>
          <div className={cx('mt-0.5 line-clamp-3 text-[12.5px]', !s.isNew && 'text-muted')}>{summarizeAround(s.body, s.viaTeam ?? viewer)}</div>
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-[11.5px] text-muted">{ago(s.createdAt)}</span>
        <button
          className="btn btn-ghost py-0 text-[11.5px] opacity-0 group-hover/row:opacity-100"
          title="Open this comment on GitHub (Revio shows review comments, not the PR conversation)"
          onClick={() => void window.revio.openExternal(s.url)}
        >
          GitHub ↗
        </button>
      </div>
    </li>
  )
}
