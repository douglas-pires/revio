import { Octokit } from '@octokit/rest'
import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import type { GithubAuthStatus, GithubTokenSource } from '@shared/types'
import { loginShell } from './shell'
import { store } from './store'

export interface ResolvedToken {
  token: string
  source: GithubTokenSource
}

/**
 * Settings first, then the project's .env (development only), then GH_TOKEN / GITHUB_TOKEN from the
 * environment, then the GitHub CLI login.
 */
export async function resolveToken(): Promise<ResolvedToken> {
  const stored = store.githubToken()
  if (stored) return { token: stored, source: 'settings' }
  const fromDotEnv = dotEnvToken()
  if (fromDotEnv) return { token: fromDotEnv, source: 'dotenv' }
  if (process.env.GH_TOKEN) return { token: process.env.GH_TOKEN, source: 'GH_TOKEN' }
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN, source: 'GITHUB_TOKEN' }
  const fromCli = await loginShell('gh auth token').catch(() => '')
  if (fromCli) return { token: fromCli, source: 'gh-cli' }
  throw new Error('No GitHub token. Run `gh auth login`, or paste a token in Settings.')
}

/** GH_TOKEN or GITHUB_TOKEN from the project's .env. Read on every call, so edits apply on the next poll. */
function dotEnvToken(): string | undefined {
  if (app.isPackaged) return undefined
  let vars: Record<string, string | undefined>
  try {
    vars = parseEnv(readFileSync(join(app.getAppPath(), '.env'), 'utf8'))
  } catch {
    return undefined
  }
  return vars.GH_TOKEN?.trim() || vars.GITHUB_TOKEN?.trim() || undefined
}

/** Who a token belongs to and what it may do. Throws when GitHub rejects it. */
export async function inspectToken(token: string): Promise<Pick<GithubAuthStatus, 'login' | 'scopes' | 'canSeeTeams'>> {
  const res = await new Octokit({ auth: token, userAgent: 'revio' }).request('GET /user')
  const scopes = parseScopes(res.headers['x-oauth-scopes'])
  return { login: res.data.login, scopes, canSeeTeams: scopes && scopes.some((s) => /^(read|write|admin):org$/.test(s)) }
}

/** Classic tokens list their scopes in a header; fine-grained tokens send none (null = unknown). */
export function parseScopes(header: string | undefined): string[] | null {
  if (header === undefined) return null
  return header
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function githubAuthStatus(): Promise<GithubAuthStatus> {
  let resolved: ResolvedToken
  try {
    resolved = await resolveToken()
  } catch (err) {
    return { source: 'none', login: null, scopes: null, canSeeTeams: null, error: errorText(err) }
  }
  try {
    return { source: resolved.source, ...(await inspectToken(resolved.token)) }
  } catch (err) {
    return { source: resolved.source, login: null, scopes: null, canSeeTeams: null, error: errorText(err) }
  }
}

/** Checks the token with GitHub before storing it, so a bad paste never replaces a working setup. */
export async function saveGithubToken(raw: string): Promise<void> {
  const token = raw.trim()
  if (!token) throw new Error('Paste a token first.')
  try {
    await inspectToken(token)
  } catch (err) {
    throw new Error(`GitHub rejected this token: ${errorText(err)}`)
  }
  store.updateSettings({ githubToken: token })
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
