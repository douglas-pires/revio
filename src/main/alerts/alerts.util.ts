import type { Inbox, PullSummary } from '@shared/inbox.types.ts'
import type { Mention, MentionSnippet, MentionsInbox } from '@shared/mention.types.ts'
import type { Settings } from '@shared/settings.types.ts'
import { MS_PER_HOUR } from '@shared/time.util.ts'

/** Waits shorter than this read in hours ("30h"); longer ones in days ("3d"). */
const MAX_HOURS_SHOWN = 48

type RequestChange = 'first' | 'repeat'

const REQUEST_VERBS: Record<RequestChange, string> = { first: 'Review requested', repeat: 'Re-review requested' }

/** The request time we alert on; GitHub does not always say when a review was requested. */
const requestMarker = (pr: PullSummary) => pr.requestedAt ?? pr.createdAt

function recordStaleAlert(pr: PullSummary, state: AlertState, now: number) {
  state.staleAlertedAt[pr.id] = new Date(now).toISOString()
}

function requestTitle(change: RequestChange, pr: PullSummary) {
  const verb = REQUEST_VERBS[change]
  if (pr.viaTeam) {
    return `${verb} (via @${pr.viaTeam})`
  }
  return verb
}

/** Whether this kind of request is set to notify: new ones and re-requests have their own settings. */
function wantsRequestAlert(change: RequestChange, settings: AlertSettings) {
  if (change === 'repeat') {
    return settings.notifyOnReRequest
  }
  return settings.notifyOnRequest
}

/** Notifies about one queued PR: a new or renewed request, and a stale one when its alert is due. Records the latter. */
function alertRequest(pr: PullSummary, change: RequestChange | null, context: Required<AlertContext>) {
  if (change && wantsRequestAlert(change, context.settings)) {
    context.notify(requestTitle(change, pr), describePull(pr), pr)
  }
  if (
    context.settings.notifyOnStale &&
    isStaleAlertDue(pr, context.state, context.settings.staleRepeatHours, context.now)
  ) {
    recordStaleAlert(pr, context.state, context.now)
    context.notify(`Stale review · waiting ${formatHours(pr.waitingHours)}`, describePull(pr), pr)
  }
}

const describePull = (pr: PullSummary) => `${pr.repo}#${pr.number} · ${pr.title}\nby ${pr.author}`

interface MentionAlert {
  mention: Mention
  snippet: MentionSnippet
}

export interface AlertState {
  /** requestedAt we last alerted about, per PR node id. */
  requested: Record<string, string>
  /** Last time a stale alert fired, per PR node id. */
  staleAlertedAt: Record<string, string>
  /** False until the first successful poll, so a fresh install does not alert on the whole backlog. */
  seeded: boolean
  /**
   * Mentions already seen, by comment URL, with when they were written (to prune old ones). Replaces the old
   * `mentionsAlerted`, which held only unread mentions: a fresh key means the first fetch after upgrading records
   * the backlog silently instead of alerting on every mention in the window.
   */
  seenMentions: Record<string, string>
  /** False until the first mentions fetch, which records existing mentions silently. */
  seenMentionsRecorded: boolean
}

export type AlertSettings = Pick<
  Settings,
  'notifyOnRequest' | 'notifyOnReRequest' | 'notifyOnStale' | 'staleRepeatHours'
>

export type Notify = (title: string, body: string, pr: PullSummary) => void

export interface AlertContext {
  settings: AlertSettings
  /** Mutated in place; the caller persists it. */
  state: AlertState
  notify: Notify
  now?: number
}

/** New and re-requested reviews, then stale ones; the first run after install records the backlog silently. */
export function raiseAlerts(inbox: Inbox, { settings, state, notify, now = Date.now() }: AlertContext) {
  for (const pr of inbox.requested) {
    const change = requestChange(pr, state)
    if (change) {
      recordRequest(pr, state)
    }
    if (state.seeded) {
      alertRequest(pr, change, { settings, state, notify, now })
    }
  }
  forgetLeftQueue(state, new Set(inbox.requested.map((pull) => pull.id)))
  state.seeded = true
}

/**
 * Whether this request is new ('first'), renewed ('repeat'), or already alerted (null). Does not change state.
 * A request on a PR you already reviewed is a re-request even though the PR left your queue in between (your review
 * takes you off its reviewers, so Revio forgot it).
 */
export function requestChange(pr: PullSummary, state: AlertState): RequestChange | null {
  const seen = state.requested[pr.id]
  if (seen === requestMarker(pr)) {
    return null
  }
  if (seen || pr.yourLastReviewAt !== null) {
    return 'repeat'
  }
  return 'first'
}

/** Remembers the request and restarts its stale clock. */
export function recordRequest(pr: PullSummary, state: AlertState) {
  state.requested[pr.id] = requestMarker(pr)
  delete state.staleAlertedAt[pr.id]
}

export function isStaleAlertDue(pr: PullSummary, state: AlertState, repeatHours: number, now: number) {
  if (!pr.stale) {
    return false
  }
  const last = state.staleAlertedAt[pr.id]
  if (!last) {
    return true
  }
  return repeatHours > 0 && now - new Date(last).getTime() >= repeatHours * MS_PER_HOUR
}

/** PRs that left the queue are forgotten, so a later re-request alerts again. */
export function forgetLeftQueue(state: AlertState, live: Set<string>) {
  for (const id of Object.keys(state.requested)) {
    if (!live.has(id)) {
      delete state.requested[id]
    }
  }
  for (const id of Object.keys(state.staleAlertedAt)) {
    if (!live.has(id)) {
      delete state.staleAlertedAt[id]
    }
  }
}

export function formatHours(hours: number) {
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`
  }
  if (hours < MAX_HOURS_SHOWN) {
    return `${Math.round(hours)}h`
  }
  return `${Math.round(hours / 24)}d`
}

/**
 * Mentions not seen before. Empty until the first fetch has been recorded. Does not change state.
 * This does not wait for GitHub to call a mention unread: that needs the notifications API, which fine-grained
 * tokens cannot read, so mentions would never alert with one.
 */
export function findUnalertedMentions(inbox: MentionsInbox, state: AlertState): MentionAlert[] {
  if (!state.seenMentionsRecorded) {
    return []
  }
  return inbox.mentions.flatMap((mention) =>
    mention.snippets.filter((snippet) => !state.seenMentions[snippet.id]).map((snippet) => ({ mention, snippet })),
  )
}

/**
 * Remembers every mention as seen, forgets mentions that left the fetched window, and marks the
 * first fetch as recorded (so a fresh install does not alert on the backlog). Mutates `state`.
 */
export function recordMentionAlerts(inbox: MentionsInbox, state: AlertState) {
  const snippets = inbox.mentions.flatMap((mention) => mention.snippets)
  const inWindow = new Set(snippets.map((snippet) => snippet.id))
  for (const snippet of snippets) {
    state.seenMentions[snippet.id] ??= snippet.createdAt
  }
  for (const id of Object.keys(state.seenMentions)) {
    if (!inWindow.has(id)) {
      delete state.seenMentions[id]
    }
  }
  state.seenMentionsRecorded = true
}
