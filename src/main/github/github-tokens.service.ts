import { Octokit } from '@octokit/rest'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import type { GithubAuthStatus, GithubTokenSource } from '@shared/types'

export interface ResolvedToken {
  token: string
  source: GithubTokenSource
}

/** Where tokens come from, injected so this module needs neither Electron nor the store. */
export interface TokenSources {
  readSaved: () => string | undefined
  save: (token: string) => void
  /** The project's .env when running from source; null in the packaged app. */
  dotEnvPath: string | null
  env: Readonly<Record<string, string | undefined>>
  readCliToken: () => Promise<string>
}

type Candidate = [GithubTokenSource, () => string | undefined | Promise<string | undefined>]

/** The GitHub token in use, what it can do, and saving a pasted one. */
export class GithubTokens {
  readonly #sources: TokenSources

  constructor(sources: TokenSources) {
    this.#sources = sources
  }

  /** Settings first, then .env (from source only), then GH_TOKEN / GITHUB_TOKEN, then the GitHub CLI login. */
  async resolve(): Promise<ResolvedToken> {
    for (const [source, read] of this.#candidates()) {
      const token = await read()
      if (token) return { token, source }
    }
    throw new Error('No GitHub token. Run `gh auth login`, or paste a token in Settings.')
  }

  async describe(): Promise<GithubAuthStatus> {
    const resolved = await this.resolve().catch((err: unknown) => err)
    if (!isResolvedToken(resolved)) return failedStatus('none', resolved)
    return inspectToken(resolved.token).then(
      (details) => ({ source: resolved.source, ...details }),
      (err: unknown) => failedStatus(resolved.source, err),
    )
  }

  /** Checks the token with GitHub before storing it, so a bad paste never replaces a working setup. */
  async verifyAndSave(raw: string): Promise<void> {
    const token = raw.trim()
    if (!token) throw new Error('Paste a token first.')
    await inspectToken(token).catch((err: unknown) => {
      throw new Error(`GitHub rejected this token: ${toErrorText(err)}`)
    })
    this.#sources.save(token)
  }

  #candidates(): Candidate[] {
    const s = this.#sources
    return [
      ['settings', s.readSaved],
      ['dotenv', () => readDotEnvToken(s.dotEnvPath)],
      ['GH_TOKEN', () => s.env.GH_TOKEN],
      ['GITHUB_TOKEN', () => s.env.GITHUB_TOKEN],
      ['gh-cli', () => s.readCliToken().catch(() => undefined)],
    ]
  }
}

/** GH_TOKEN or GITHUB_TOKEN from a .env file, read on every call so edits apply on the next poll. */
export function readDotEnvToken(path: string | null): string | undefined {
  if (!path) return undefined
  try {
    const vars = parseEnv(readFileSync(path, 'utf8'))
    return vars.GH_TOKEN?.trim() || vars.GITHUB_TOKEN?.trim() || undefined
  } catch {
    return undefined
  }
}

/** Who a token belongs to and what it may do. Throws when GitHub rejects it. */
async function inspectToken(token: string): Promise<Pick<GithubAuthStatus, 'login' | 'scopes' | 'canSeeTeams'>> {
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

const isResolvedToken = (value: unknown): value is ResolvedToken => typeof value === 'object' && value !== null && 'token' in value

const failedStatus = (source: GithubTokenSource, err: unknown): GithubAuthStatus => ({ source, login: null, scopes: null, canSeeTeams: null, error: toErrorText(err) })

const toErrorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
