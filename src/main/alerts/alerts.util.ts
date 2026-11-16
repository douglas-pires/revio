import type { Inbox, PullSummary } from '@shared/inbox.types'
import type { Mention, MentionSnippet, MentionsInbox } from '@shared/mention.types'
import type { Settings } from '@shared/settings.types'

export interface AlertState {
  /** requestedAt we last alerted about, per PR node id. */
  requested: Record<string, string>
  /** Last time a stale alert fired, per PR node id. */
  staleAlertedAt: Record<string, string>
  /** False until the first successful poll, so a fresh install does not alert on the whole backlog. */
  seeded: boolean
  /** Mentions already alerted, by comment URL, with when they were written (to prune old ones). */
  mentionsAlerted: Record<string, string>
  /** False until the first mentions fetch, which records existing mentions silently. */
  mentionsSeeded: boolean
}

export type AlertSettings = Pick<Settings, 'notifyOnRequest' | 'notifyOnStale' | 'staleRepeatHours'>

export type Notify = (title: string, body: string, pr: PullSummary) => void

const HOUR_MS = 36e5

export interface AlertContext {
  settings: AlertSettings
  /** Mutated in place; the caller persists it. */
  state: AlertState
  notify: Notify
  now?: number
}

type RequestChange = 'first' | 'repeat'

/** New and re-requested reviews, then stale ones; the first run after install records the backlog silently. */
export function raiseAlerts(inbox: Inbox, { settings, state, notify, now = Date.now() }: AlertContext) {
  for (const pr of inbox.requested) {
    const change = requestChange(pr, state)
    if (change) recordRequest(pr, state)
    if (!state.seeded) continue
    if (change && settings.notifyOnRequest) notify(requestTitle(change, pr), describePull(pr), pr)
    if (settings.notifyOnStale && isStaleAlertDue(pr, state, settings.staleRepeatHours, now)) {
      recordStaleAlert(pr, state, now)
      notify(`Stale review · waiting ${formatHours(pr.waitingHours)}`, describePull(pr), pr)
    }
  }
  forgetLeftQueue(state, new Set(inbox.requested.map((p) => p.id)))
  state.seeded = true
}

/** The request time we alert on; GitHub does not always say when a review was requested. */
const requestMarker = (pr: PullSummary) => pr.requestedAt ?? pr.createdAt

/** Whether this request is new ('first'), renewed ('repeat'), or already alerted (null). Does not change state. */
export function requestChange(pr: PullSummary, state: AlertState): RequestChange | null {
  const seen = state.requested[pr.id]
  if (seen === requestMarker(pr)) return null
  return seen ? 'repeat' : 'first'
}

/** Remembers the request and restarts its stale clock. */
export function recordRequest(pr: PullSummary, state: AlertState) {
  state.requested[pr.id] = requestMarker(pr)
  delete state.staleAlertedAt[pr.id]
}

function recordStaleAlert(pr: PullSummary, state: AlertState, now: number) {
  state.staleAlertedAt[pr.id] = new Date(now).toISOString()
}

function requestTitle(change: RequestChange, pr: PullSummary) {
  const verb = change === 'repeat' ? 'Re-review requested' : 'Review requested'
  return pr.viaTeam ? `${verb} (via @${pr.viaTeam})` : verb
}

export function isStaleAlertDue(pr: PullSummary, state: AlertState, repeatHours: number, now: number) {
  if (!pr.stale) return false
  const last = state.staleAlertedAt[pr.id]
  if (!last) return true
  return repeatHours > 0 && now - new Date(last).getTime() >= repeatHours * HOUR_MS
}

/** PRs that left the queue are forgotten, so a later re-request alerts again. */
export function forgetLeftQueue(state: AlertState, live: Set<string>) {
  for (const id of Object.keys(state.requested)) if (!live.has(id)) delete state.requested[id]
  for (const id of Object.keys(state.staleAlertedAt)) if (!live.has(id)) delete state.staleAlertedAt[id]
}

const describePull = (pr: PullSummary) => `${pr.repo}#${pr.number} · ${pr.title}\nby ${pr.author}`

export function formatHours(h: number) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

type MentionAlert = { mention: Mention; snippet: MentionSnippet }

/** New (unread) mentions not alerted before. Empty until the first fetch has been recorded. Does not change state. */
export function findUnalertedMentions(inbox: MentionsInbox, state: AlertState): MentionAlert[] {
  if (!state.mentionsSeeded) return []
  return inbox.mentions.flatMap((mention) =>
    mention.snippets.filter((s) => s.isNew && !state.mentionsAlerted[s.id]).map((snippet) => ({ mention, snippet })),
  )
}

/**
 * Remembers every new mention as alerted, forgets mentions that left the fetched window, and marks the
 * first fetch as recorded (so a fresh install does not alert on the backlog). Mutates `state`.
 */
export function recordMentionAlerts(inbox: MentionsInbox, state: AlertState) {
  const live = new Set(inbox.mentions.flatMap((m) => m.snippets.map((s) => s.id)))
  for (const m of inbox.mentions) for (const s of m.snippets) if (s.isNew) state.mentionsAlerted[s.id] ??= s.createdAt
  for (const id of Object.keys(state.mentionsAlerted)) if (!live.has(id)) delete state.mentionsAlerted[id]
  state.mentionsSeeded = true
}
