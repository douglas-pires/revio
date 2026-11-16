import type { Octokit } from '@octokit/rest'
import type { MentionsInbox } from '@shared/types'
import { InFlight } from './inFlight'
import { buildMention, markMentionRead, sortMentions, type NotificationInfo, type RawMentionPr } from './mentionMatch'
import { splitRepo } from './github'

export const MENTION_WINDOW_DAYS = 14
/** PRs looked at per refresh; aliased lookups per GraphQL query. */
const MAX_PRS = 40
const PRS_PER_QUERY = 20

const TEXT = 'author { login avatarUrl(size: 64) } body createdAt url'
const PR_FIELDS = `number title state url ${TEXT} repository { nameWithOwner }
  comments(last: 50) { nodes { ${TEXT} } }
  reviews(last: 30) { nodes { ${TEXT} } }
  reviewThreads(last: 30) { nodes { path line comments(last: 10) { nodes { ${TEXT} } } } }`

const toPrKey = (repo: string, number: number) => `${repo}#${number}`.toLowerCase()

interface Notification extends NotificationInfo {
  key: string
  repo: string
  number: number
  reason: string
}

/**
 * PRs that mention you or your teams in the last two weeks. Candidates come from search (mentions:@me) and
 * from GitHub notifications, since a notification keeps only its latest reason and search misses some
 * review comments; each candidate's texts are then checked for the actual mention.
 */
export async function fetchMentions(octokit: Octokit): Promise<MentionsInbox> {
  const since = new Date(Date.now() - MENTION_WINDOW_DAYS * 864e5)
  const [viewer, notifications, searched, teams] = await Promise.all([
    octokit.request('GET /user').then((r) => r.data.login),
    listPrNotifications(octokit, since),
    searchMentionedPrs(octokit, since),
    listTeamHandles(octokit),
  ])
  const byKey = new Map(notifications.map((n) => [n.key, n]))
  const candidates = new Map<string, { repo: string; number: number }>()
  for (const p of searched) candidates.set(toPrKey(p.repo, p.number), p)
  for (const n of notifications) if (n.reason === 'mention' || n.reason === 'team_mention') candidates.set(n.key, n)

  const prs = await fetchPrTexts(octokit, [...candidates.values()].slice(0, MAX_PRS))
  const mentions = prs.flatMap((pr) => {
    const m = buildMention(pr, { viewer, teams, since: since.toISOString(), notification: byKey.get(toPrKey(pr.repository.nameWithOwner, pr.number)) })
    return m ? [m] : []
  })
  return { viewer, mentions: sortMentions(mentions), windowDays: MENTION_WINDOW_DAYS, fetchedAt: new Date().toISOString() }
}

async function listPrNotifications(octokit: Octokit, since: Date): Promise<Notification[]> {
  try {
    const { data } = await octokit.request('GET /notifications', { all: true, participating: true, since: since.toISOString(), per_page: 50 })
    return data.flatMap((n) => {
      const number = Number(n.subject.url?.split('/').at(-1))
      if (n.subject.type !== 'PullRequest' || !number) return []
      const repo = n.repository.full_name
      return [{ id: n.id, unread: n.unread, lastReadAt: n.last_read_at, reason: n.reason, repo, number, key: toPrKey(repo, number) }]
    })
  } catch (err) {
    // Fine-grained tokens cannot read notifications; mentions still come from search, without unread state.
    console.error('[revio] notifications unavailable:', err instanceof Error ? err.message : err)
    return []
  }
}

async function searchMentionedPrs(octokit: Octokit, since: Date) {
  const { data } = await octokit.request('GET /search/issues', { q: `is:pr mentions:@me updated:>=${since.toISOString().slice(0, 10)}`, per_page: 50 })
  return data.items.map((i) => ({ repo: i.repository_url.split('/').slice(-2).join('/'), number: i.number }))
}

/** Your teams as org/slug. Needs read:org; without it only mentions of you by name are found. */
async function listTeamHandles(octokit: Octokit): Promise<string[]> {
  try {
    const { data } = await octokit.request('GET /user/teams', { per_page: 100 })
    return data.map((t) => `${t.organization.login}/${t.slug}`)
  } catch {
    return []
  }
}

async function fetchPrTexts(octokit: Octokit, prs: { repo: string; number: number }[]): Promise<RawMentionPr[]> {
  const found: RawMentionPr[] = []
  for (let i = 0; i < prs.length; i += PRS_PER_QUERY) {
    const chunk = prs.slice(i, i + PRS_PER_QUERY)
    const parts = chunk.map(({ repo: full, number }, k) => {
      const { owner, repo } = splitRepo(full)
      return `p${k}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) { pullRequest(number: ${number}) { ${PR_FIELDS} } }`
    })
    const data = await octokit.graphql<Record<string, { pullRequest: RawMentionPr | null } | null>>(`query {\n${parts.join('\n')}\n}`)
    chunk.forEach((_, k) => {
      const pr = data[`p${k}`]?.pullRequest
      if (pr) found.push(pr)
    })
  }
  return found
}

export interface MentionWatcherDeps {
  load: () => Promise<MentionsInbox>
  markRead: (notificationId: string) => Promise<void>
  onMentions: (inbox: MentionsInbox) => void
}

/** Keeps the latest mentions; concurrent refreshes share one request. Errors keep the last good list. */
export class MentionWatcher {
  #latest: MentionsInbox | null = null
  readonly #inFlight = new InFlight<MentionsInbox>()
  readonly #deps: MentionWatcherDeps

  constructor(deps: MentionWatcherDeps) {
    this.#deps = deps
  }

  get latest() {
    return this.#latest
  }

  refresh(): Promise<MentionsInbox> {
    return this.#inFlight.run('mentions', () => this.#load())
  }

  /** Marks the PR's GitHub notification read and clears its "new" mentions. */
  async markRead(repo: string, number: number) {
    const mention = this.#latest?.mentions.find((m) => m.repo === repo && m.number === number)
    if (mention?.notificationId) await this.#deps.markRead(mention.notificationId)
    if (!this.#latest) return
    this.#publish({ ...this.#latest, mentions: markMentionRead(this.#latest.mentions, repo, number) })
  }

  async #load(): Promise<MentionsInbox> {
    try {
      this.#publish(await this.#deps.load())
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[revio] mentions failed:', error)
      this.#publish(this.#latest ? { ...this.#latest, error } : { viewer: '', mentions: [], windowDays: MENTION_WINDOW_DAYS, fetchedAt: new Date().toISOString(), error })
    }
    return this.#latest!
  }

  #publish(inbox: MentionsInbox) {
    this.#latest = inbox
    this.#deps.onMentions(inbox)
  }
}
