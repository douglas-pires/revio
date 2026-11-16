import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Inbox, Mention, MentionsInbox, PullSummary } from '@shared/types'
import { formatHours, isStaleAlertDue, raiseAlerts, recordRequest, requestChange, takeNewMentions, type AlertSettings, type AlertState, type Notify } from '../src/main/alerts'
import { makeSummary } from './fixtures'

const HOUR = 36e5
const NOW = Date.parse('2026-11-16T12:00:00Z')
const settings: AlertSettings = { notifyOnRequest: true, notifyOnStale: true, staleRepeatHours: 24 }
const makeInbox = (...requested: PullSummary[]): Inbox => ({ viewer: 'me', requested, reviewed: [], stacks: [], fetchedAt: '' })

let state: AlertState
const runAlerts = (inbox: Inbox, notify: Notify, now = NOW, alertSettings = settings) => raiseAlerts(inbox, { settings: alertSettings, state, notify, now })
beforeEach(() => {
  state = { requested: {}, staleAlertedAt: {}, seeded: true, mentionsAlerted: {}, mentionsSeeded: true }
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
    expect(notify.mock.calls[0]![0]).toBe('Review requested')
    expect(notify.mock.calls[0]![1]).toBe('acme/web#1 · Add thing\nby ana')
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
    state.requested.PR_1 = stale.requestedAt!
    runAlerts(makeInbox(stale), notify, NOW)
    runAlerts(makeInbox(stale), notify, NOW + 23 * HOUR)
    runAlerts(makeInbox(stale), notify, NOW + 24 * HOUR)
    expect(notify.mock.calls.map((c) => c[0])).toEqual(['Stale review · waiting 30h', 'Stale review · waiting 30h'])
  })

  it('respects the notification switches', () => {
    const notify = vi.fn()
    runAlerts(makeInbox(makeSummary({ stale: true })), notify, NOW, { ...settings, notifyOnRequest: false, notifyOnStale: false })
    expect(notify).not.toHaveBeenCalled()
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

describe('takeNewMentions', () => {
  const snippet = (id: string, isNew: boolean) => ({
    id, kind: 'comment' as const, author: 'bo', authorAvatar: '', body: '@me', createdAt: '2026-11-10T00:00:00Z', url: id, path: null, line: null, viaTeam: null, isNew,
  })
  const mention = (...snippets: ReturnType<typeof snippet>[]): Mention => ({ repo: 'acme/web', number: 1, title: 't', url: '', state: 'OPEN', notificationId: 'N', snippets, latestAt: '' })
  const makeMentions = (...mentions: Mention[]): MentionsInbox => ({ viewer: 'me', mentions, windowDays: 14, fetchedAt: '' })

  it('records the first fetch silently', () => {
    state.mentionsSeeded = false
    expect(takeNewMentions(makeMentions(mention(snippet('a', true))), state)).toEqual([])
    expect(state.mentionsSeeded).toBe(true)
    expect(takeNewMentions(makeMentions(mention(snippet('a', true))), state)).toEqual([])
  })

  it('alerts once per new mention, never for read ones', () => {
    const first = takeNewMentions(makeMentions(mention(snippet('a', true), snippet('b', false))), state)
    expect(first.map((f) => f.snippet.id)).toEqual(['a'])
    expect(takeNewMentions(makeMentions(mention(snippet('a', true))), state)).toEqual([])
  })

  it('forgets mentions that left the window', () => {
    takeNewMentions(makeMentions(mention(snippet('a', true))), state)
    takeNewMentions(makeMentions(), state)
    expect(state.mentionsAlerted).toEqual({})
  })
})
