import { summarizeComment } from '@shared/excerpt.util'
import type { Mention, MentionSnippet, MentionsInbox } from '@shared/mention.types'
import type { PullRef } from '@shared/pull.types'
import { findUnalertedMentions, recordMentionAlerts, type AlertState } from '../alerts/alerts.util'

export interface MentionAlertDeps {
  state: () => AlertState
  save: () => void
  enabled: () => boolean
  show: (title: string, body: string, onClick: () => void) => void
  openPull: (ref: PullRef) => void
  showApp: () => void
}

/** Past this many, new mentions are summed up in one notification. */
const MAX_SEPARATE_ALERTS = 3

/** A desktop notification per new mention (a summary past three), unless turned off in Settings. */
export function alertNewMentions(mentions: MentionsInbox, deps: MentionAlertDeps) {
  if (mentions.error) return
  const state = deps.state()
  const fresh = findUnalertedMentions(mentions, state)
  recordMentionAlerts(mentions, state)
  deps.save()
  if (!deps.enabled()) return
  for (const { mention, snippet } of fresh.slice(0, MAX_SEPARATE_ALERTS)) {
    const { title, body } = describeMentionAlert(mention, snippet)
    deps.show(title, body, () => deps.openPull(mention))
  }
  const rest = fresh.length - MAX_SEPARATE_ALERTS
  if (rest > 0) deps.show(`${rest} more mentions`, 'Open Revio → Mentions to see them all.', deps.showApp)
}

export function describeMentionAlert(mention: Mention, snippet: MentionSnippet) {
  const who = snippet.viaTeam ? `@${snippet.viaTeam}` : 'you'
  return {
    title: `${snippet.author} mentioned ${who}`,
    body: `${mention.repo}#${mention.number} · ${mention.title}\n${summarizeComment(snippet.body, 140)}`,
  }
}
