import { Octokit } from '@octokit/rest'
import type { ResolvedToken } from './github-tokens.service.ts'

/** The authenticated Octokit for the current token. Module state: one GitHub identity per app. */
let client: { token: string; octokit: Octokit } | null = null

let resolveToken: () => Promise<ResolvedToken> = () =>
  Promise.reject(new Error('GitHub token sources are not set up yet.'))

let cachedViewer: { token: string; login: string } | null = null

/** Called once by the composition root with the injected token lookup. */
export function configureTokenResolver(resolve: () => Promise<ResolvedToken>) {
  resolveToken = resolve
  resetClient()
}

export async function getGithubClient(): Promise<Octokit> {
  const { token } = await resolveToken()
  if (client?.token !== token) {
    client = { token, octokit: new Octokit({ auth: token, userAgent: 'revio' }) }
  }
  return client.octokit
}

/** The token the client currently uses, or null before the first request. */
export const readTokenInUse = () => client?.token ?? null

export function resetClient() {
  client = null
}

export async function getViewerLogin(): Promise<string> {
  const octokit = await getGithubClient()
  const token = readTokenInUse()
  if (cachedViewer !== null && cachedViewer.token === token) {
    return cachedViewer.login
  }
  const { data } = await octokit.users.getAuthenticated()
  if (token !== null) {
    cachedViewer = { token, login: data.login }
  }
  return data.login
}

/** GitHub serves 460px avatars by default; the app shows them at 20–28px. */
export function buildSmallAvatarUrl(url: string | undefined) {
  if (!url) {
    return ''
  }
  const avatarUrl = new URL(url)
  avatarUrl.searchParams.set('s', '64')
  return avatarUrl.toString()
}
