import type { Octokit } from '@octokit/rest'
import { readErrorMessage } from '@shared/error.util.ts'
import type { MentionsInbox } from '@shared/mention.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { buildMention, type NotificationInfo, type RawMentionPr, sortMentions } from './mention-match.util.ts'

/** PRs looked at per refresh; aliased lookups per GraphQL query. */
const MAX_PRS = 40

const PRS_PER_QUERY = 20

const TEXT = 'author { login avatarUrl(size: 64) } body createdAt url'

const PR_FIELDS = `number title state url ${TEXT} repository { nameWithOwner }
  comments(last: 50) { nodes { ${TEXT} } }
  reviews(last: 30) { nodes { ${TEXT} } }
  reviewThreads(last: 30) { nodes { path line comments(last: 10) { nodes { ${TEXT} } } } }`

/** Case-insensitive, since GitHub URLs and search results may differ in owner case. */
const toPrKey = (ref: PullRef) => buildPullKey(ref).toLowerCase()

interface Notification extends NotificationInfo, PullRef {
  key: string
  reason: string
}

/** PRs search found, plus PRs whose notification says you or your team were mentioned. */
function collectCandidates(searched: PullRef[], notifications: Notification[]): PullRef[] {
  const candidates = new Map(searched.map((pull) => [toPrKey(pull), pull]))
  for (const notification of notifications) {
    if (notification.reason === 'mention' || notification.reason === 'team_mention') {
      candidates.set(notification.key, notification)
    }
  }
  return [...candidates.values()]
}

async function listPrNotifications(octokit: Octokit, since: Date): Promise<Notification[]> {
  try {
    const { data } = await octokit.request('GET /notifications', {
      all: true,
      participating: true,
      since: since.toISOString(),
      per_page: 50,
    })
    return data.flatMap((notification) => {
      const number = Number(notification.subject.url?.split('/').at(-1))
      if (notification.subject.type !== 'PullRequest' || !number) {
        return []
      }
      const repo = notification.repository.full_name
      return [
        {
          id: notification.id,
          unread: notification.unread,
          lastReadAt: notification.last_read_at,
          reason: notification.reason,
          repo,
          number,
          key: toPrKey({ repo, number }),
        },
      ]
    })
  } catch (err) {
    // Fine-grained tokens cannot read notifications; mentions still come from search, without unread state.
    console.error('[revio] notifications unavailable:', readErrorMessage(err))
    return []
  }
}

async function searchMentionedPrs(octokit: Octokit, since: Date): Promise<PullRef[]> {
  const { data } = await octokit.request('GET /search/issues', {
    q: `is:pr mentions:@me updated:>=${since.toISOString().slice(0, 10)}`,
    per_page: 50,
  })
  return data.items.map((issue) => ({
    repo: issue.repository_url.split('/').slice(-2).join('/'),
    number: issue.number,
  }))
}

/** Your teams as org/slug. Needs read:org; without it only mentions of you by name are found. */
async function listTeamHandles(octokit: Octokit): Promise<string[]> {
  try {
    const { data } = await octokit.request('GET /user/teams', { per_page: 100 })
    return data.map((team) => `${team.organization.login}/${team.slug}`)
  } catch {
    return []
  }
}

async function fetchPrTexts(octokit: Octokit, prs: PullRef[]): Promise<RawMentionPr[]> {
  const found: RawMentionPr[] = []
  for (let start = 0; start < prs.length; start += PRS_PER_QUERY) {
    const chunk = prs.slice(start, start + PRS_PER_QUERY)
    const parts = chunk.map(({ repo: full, number }, index) => {
      const { owner, repo } = splitRepo(full)
      return `p${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) { pullRequest(number: ${number}) { ${PR_FIELDS} } }`
    })
    // biome-ignore lint/performance/noAwaitInLoops: chunks run one after another to stay under GitHub's rate limits.
    const data = await octokit.graphql<Record<string, { pullRequest: RawMentionPr | null } | null>>(
      `query {\n${parts.join('\n')}\n}`,
    )
    chunk.forEach((_, index) => {
      const pr = data[`p${index}`]?.pullRequest
      if (pr) {
        found.push(pr)
      }
    })
  }
  return found
}

export const MENTION_WINDOW_DAYS = 14

/**
 * PRs that mention you or your teams in the last two weeks. Candidates come from search (mentions:@me) and
 * from GitHub notifications, since a notification keeps only its latest reason and search misses some
 * review comments; each candidate's texts are then checked for the actual mention.
 */
export async function fetchMentions(octokit: Octokit): Promise<MentionsInbox> {
  const since = new Date(Date.now() - MENTION_WINDOW_DAYS * MS_PER_DAY)
  const [viewer, notifications, searched, teams] = await Promise.all([
    octokit.request('GET /user').then((response) => response.data.login),
    listPrNotifications(octokit, since),
    searchMentionedPrs(octokit, since),
    listTeamHandles(octokit),
  ])
  const prs = await fetchPrTexts(octokit, collectCandidates(searched, notifications).slice(0, MAX_PRS))
  const notificationOf = new Map(notifications.map((notification) => [notification.key, notification]))
  const mentions = prs.flatMap((pr) => {
    const notification = notificationOf.get(toPrKey({ repo: pr.repository.nameWithOwner, number: pr.number }))
    return buildMention(pr, { viewer, teams, since: since.toISOString(), notification }) ?? []
  })
  return {
    viewer,
    mentions: sortMentions(mentions),
    windowDays: MENTION_WINDOW_DAYS,
    fetchedAt: new Date().toISOString(),
  }
}
