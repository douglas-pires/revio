import type { Inbox, PullSummary } from '@shared/inbox.types.ts'
import type { Mention, MentionsInbox } from '@shared/mention.types.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectPresent, makeSummary } from '../../../test/fixtures.ts'
import {
  type AlertSettings,
  type AlertState,
  findUnalertedMentions,
  formatHours,
  isStaleAlertDue,
  type Notify,
  raiseAlerts,
  recordMentionAlerts,
  recordRequest,
  requestChange,
} from './alerts.util.ts'

const HOUR = 36e5
const NOW = Date.parse('2026-11-16T12:00:00Z')
const settings: AlertSettings = {
  notifyOnRequest: true,
  notifyOnReRequest: true,
  notifyOnStale: true,
  staleRepeatHours: 24,
}
const makeInbox = (...requested: PullSummary[]): Inbox => ({
  viewer: 'me',
  requested,
  reviewed: [],
  stacks: [],
  fetchedAt: '',
})

let state: AlertState
const runAlerts = (inbox: Inbox, notify: Notify, now = NOW, alertSettings = settings) =>
  raiseAlerts(inbox, { settings: alertSettings, state, notify, now })
beforeEach(() => {
  state = { requested: {}, staleAlertedAt: {}, seeded: true, seenMentions: {}, seenMentionsRecorded: true }
})

describe('raiseAlerts', () => {
  it('records the backlog silently on the first run after install', () => {
    state.seeded = false
    const notify = vi.fn()
    runAlerts(makeInbox(makeSummary(), makeSummary({ id: 'PR_2', stale: true })), notify)
    expect(notify).not.toHaveBeenCalled()
    expect(state.seeded).toBe(true)
    expect(Object.keys(state.requested)).toEqual(['PR_1', 'PR_2'])
  })

  it('alerts once per request, then stays quiet on later polls', () => {
    const notify = vi.fn()
    runAlerts(makeInbox(makeSummary()), notify, NOW)
    runAlerts(makeInbox(makeSummary()), notify, NOW)
    expect(notify).toHaveBeenCalledOnce()
    expect(notify.mock.calls[0]?.[0]).toBe('Review requested')
    expect(notify.mock.calls[0]?.[1]).toBe('acme/web#1 · Add thing\nby ana')
  })

  it('says "Re-review" when the same PR is requested again, and names the team', () => {
    const notify = vi.fn()
    runAlerts(makeInbox(makeSummary()), notify, NOW)
    runAlerts(makeInbox(makeSummary({ requestedAt: '2026-11-10T00:00:00Z', viaTeam: 'web' })), notify)
    expect(notify.mock.calls.map((c) => c[0])).toEqual(['Review requested', 'Re-review requested (via @web)'])
  })

  it('alerts again after a PR leaves the queue and comes back', () => {
    const notify = vi.fn()
    runAlerts(makeInbox(makeSummary()), notify, NOW)
    runAlerts(makeInbox(), notify, NOW)
    runAlerts(makeInbox(makeSummary()), notify, NOW)
    expect(notify.mock.calls.map((c) => c[0])).toEqual(['Review requested', 'Review requested'])
  })

  it('repeats stale alerts only after the repeat interval', () => {
    const notify = vi.fn()
    const stale = makeSummary({ stale: true, waitingHours: 30 })
    state.requested.PR_1 = expectPresent(stale.requestedAt)
    runAlerts(makeInbox(stale), notify, NOW)
    runAlerts(makeInbox(stale), notify, NOW + 23 * HOUR)
    runAlerts(makeInbox(stale), notify, NOW + 24 * HOUR)
    expect(notify.mock.calls.map((c) => c[0])).toEqual(['Stale review · waiting 30h', 'Stale review · waiting 30h'])
  })

  it('respects the notification switches', () => {
    const notify = vi.fn()
    runAlerts(makeInbox(makeSummary({ stale: true })), notify, NOW, {
      ...settings,
      notifyOnRequest: false,
      notifyOnReRequest: false,
      notifyOnStale: false,
    })
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('re-requested reviews', () => {
  it('calls it a re-review when you reviewed the PR before it came back to your queue', () => {
    const notify = vi.fn()
    runAlerts(makeInbox(makeSummary()), notify, NOW)
    // Your review took you off the reviewers, so the PR left your queue; then the author asked again.
    runAlerts(makeInbox(), notify, NOW)
    const again = makeSummary({ requestedAt: '2026-11-12T09:00:00Z', yourLastReviewAt: '2026-11-11T16:00:00Z' })
    runAlerts(makeInbox(again), notify, NOW)
    expect(notify.mock.calls.map((c) => c[0])).toEqual(['Review requested', 'Re-review requested'])
  })

  it('has separate switches for new requests and re-requests', () => {
    const notify = vi.fn()
    const fresh = makeSummary({ id: 'PR_new' })
    const again = makeSummary({ id: 'PR_again', yourLastReviewAt: '2026-11-11T16:00:00Z' })
    runAlerts(makeInbox(fresh, again), notify, NOW, { ...settings, notifyOnReRequest: false })
    expect(notify.mock.calls.map((c) => c[1])).toEqual(['acme/web#1 · Add thing\nby ana'])
    expect(notify).toHaveBeenCalledOnce()
    const quiet = vi.fn()
    state.requested = {}
    runAlerts(makeInbox(fresh, again), quiet, NOW, { ...settings, notifyOnRequest: false })
    expect(quiet.mock.calls.map((c) => c[0])).toEqual(['Re-review requested'])
  })
})

describe('requestChange', () => {
  it('only answers; it does not record the request', () => {
    expect(requestChange(makeSummary(), state)).toBe('first')
    expect(state.requested).toEqual({})
  })

  it('compares against createdAt when GitHub gives no request time', () => {
    state.requested.PR_1 = '2026-11-01T10:00:00Z'
    expect(requestChange(makeSummary({ requestedAt: null }), state)).toBeNull()
    expect(requestChange(makeSummary({ requestedAt: '2026-11-02T00:00:00Z' }), state)).toBe('repeat')
  })
})

describe('recordRequest', () => {
  it('remembers the request and clears its stale marker', () => {
    state.staleAlertedAt.PR_1 = 'x'
    recordRequest(makeSummary({ requestedAt: null }), state)
    expect(state.requested.PR_1).toBe('2026-11-01T10:00:00Z')
    expect(state.staleAlertedAt.PR_1).toBeUndefined()
  })
})

// biome-ignore lint/security/noSecrets: a test name, not a secret.
describe('isStaleAlertDue', () => {
  it('never repeats when the repeat interval is 0', () => {
    state.staleAlertedAt.PR_1 = new Date(NOW - 1000 * HOUR).toISOString()
    expect(isStaleAlertDue(makeSummary({ stale: true }), state, 0, NOW)).toBe(false)
  })
})

describe('formatHours', () => {
  it.each([
    [0, '1m'],
    [0.25, '15m'],
    [5, '5h'],
    [49, '2d'],
  ])('%d → %s', (h, s) => expect(formatHours(h)).toBe(s))
})

describe('mention alerts', () => {
  const snippet = (id: string, isNew: boolean) => ({
    id,
    kind: 'comment' as const,
    author: 'bo',
    authorAvatar: '',
    body: '@me',
    createdAt: '2026-11-10T00:00:00Z',
    url: id,
    path: null,
    line: null,
    commentId: null,
    viaTeam: null,
    isNew,
  })
  const mention = (...snippets: ReturnType<typeof snippet>[]): Mention => ({
    repo: 'acme/web',
    number: 1,
    title: 't',
    url: '',
    state: 'OPEN',
    notificationId: 'N',
    snippets,
    latestAt: '',
  })
  const makeMentions = (...mentions: Mention[]): MentionsInbox => ({
    viewer: 'me',
    mentions,
    windowDays: 14,
    fetchedAt: '',
  })
  const alertIds = (inbox: MentionsInbox) => findUnalertedMentions(inbox, state).map((a) => a.snippet.id)

  it('finds nothing before the first fetch is recorded, which is silent', () => {
    state.seenMentionsRecorded = false
    const inbox = makeMentions(mention(snippet('a', true)))
    expect(alertIds(inbox)).toEqual([])
    recordMentionAlerts(inbox, state)
    expect(state.seenMentionsRecorded).toBe(true)
    expect(alertIds(inbox)).toEqual([])
  })

  it('finds each mention once, read or not, and finding does not record', () => {
    // Without notifications access (fine-grained tokens) GitHub never says a mention is unread.
    const inbox = makeMentions(mention(snippet('a', true), snippet('b', false)))
    expect(alertIds(inbox)).toEqual(['a', 'b'])
    expect(alertIds(inbox)).toEqual(['a', 'b'])
    recordMentionAlerts(inbox, state)
    expect(alertIds(inbox)).toEqual([])
  })

  it('forgets mentions that left the window', () => {
    recordMentionAlerts(makeMentions(mention(snippet('a', true))), state)
    recordMentionAlerts(makeMentions(), state)
    expect(state.seenMentions).toEqual({})
  })
})

describe('describeMentionAlert', () => {
  it('names the team when a team was mentioned', async () => {
    const { describeMentionAlert } = await import('../mentions/mention-alerts.service.ts')
    const m: Mention = {
      repo: 'acme/web',
      number: 3,
      title: 'Speed up',
      url: '',
      state: 'OPEN',
      notificationId: null,
      snippets: [],
      latestAt: '',
    }
    const snippet = {
      id: 'x',
      kind: 'comment' as const,
      author: 'bo',
      authorAvatar: '',
      body: '**ping** @acme/web-team',
      createdAt: '',
      url: '',
      path: null,
      line: null,
      commentId: null,
      viaTeam: 'acme/web-team',
      isNew: true,
    }
    expect(describeMentionAlert(m, snippet)).toEqual({
      title: 'bo mentioned @acme/web-team',
      body: 'acme/web#3 · Speed up\nping @acme/web-team',
    })
  })
})
