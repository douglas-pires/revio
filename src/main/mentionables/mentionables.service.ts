import type { Octokit } from '@octokit/rest'
import type { Mentionable } from '@shared/mentionable.types.ts'
import { InFlight } from '../common/in-flight.util.ts'
import { getGithubClient } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'

/** Pages of 100 people read at most, so a huge organization does not hold up typing. */
const MAX_PAGES = 5

interface PeoplePage {
  repository: {
    mentionableUsers: {
      nodes: { login: string; name: string | null; avatarUrl: string }[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  } | null
}

interface TeamsPage {
  organization: { teams: { nodes: { combinedSlug: string; name: string; avatarUrl: string }[] } } | null
}

const PEOPLE_QUERY = `query ($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) { mentionableUsers(first: 100, after: $after) {
    nodes { login name avatarUrl(size: 40) } pageInfo { hasNextPage endCursor }
  } }
}`

const TEAMS_QUERY = `query ($owner: String!) {
  organization(login: $owner) { teams(first: 100) { nodes { combinedSlug name avatarUrl(size: 40) } } }
}`

const loaded = new Map<string, Mentionable[]>()
const loading = new InFlight<Mentionable[]>()

async function fetchPeople(octokit: Octokit, repo: string): Promise<Mentionable[]> {
  const { owner, repo: name } = splitRepo(repo)
  const people: Mentionable[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each page starts where the one before it ended.
    const response: PeoplePage = await octokit.graphql<PeoplePage>(PEOPLE_QUERY, { owner, name, after })
    const users = response.repository?.mentionableUsers
    people.push(...(users?.nodes ?? []).map(({ login, ...rest }) => ({ handle: login, ...rest })))
    if (!users?.pageInfo.hasNextPage) {
      break
    }
    after = users.pageInfo.endCursor
  }
  return people
}

/** The organization's teams; none for a personal account, or a token that may not read them. */
async function fetchTeams(octokit: Octokit, repo: string): Promise<Mentionable[]> {
  const { owner } = splitRepo(repo)
  const response = await octokit.graphql<TeamsPage>(TEAMS_QUERY, { owner }).catch(() => null)
  return (response?.organization?.teams.nodes ?? []).map(({ combinedSlug, ...rest }) => ({
    handle: combinedSlug,
    ...rest,
  }))
}

/** Who can be mentioned in a repository, people first; asked for once per repository while Revio runs. */
export function listMentionables(repo: string): Promise<Mentionable[]> {
  const known = loaded.get(repo)
  if (known) {
    return Promise.resolve(known)
  }
  return loading.run(repo, async () => {
    const octokit = await getGithubClient()
    const [people, teams] = await Promise.all([fetchPeople(octokit, repo), fetchTeams(octokit, repo)])
    const mentionables = [...people, ...teams]
    loaded.set(repo, mentionables)
    return mentionables
  })
}
