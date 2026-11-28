import type { StatsData } from '@shared/stats.types.ts'

/** Whether a login is an app, such as dependabot[bot]; their work is left out of the stats. */
export function isBot(login: string) {
  return login.endsWith('[bot]')
}

/** Whether someone's work counts in these stats: a person in the scope (anyone, for a repository). */
export function isCounted(data: Pick<StatsData, 'people'>, login: string) {
  return !isBot(login) && (data.people === null || data.people.includes(login))
}

/** Whether a request to `@org/slug` went to one of the teams the stats are about. */
export function isScopeTeam(data: Pick<StatsData, 'scope'>, reviewer: string) {
  return data.scope.kind === 'team' && data.scope.teams.some((team) => reviewer === `@${team.org}/${team.slug}`)
}
