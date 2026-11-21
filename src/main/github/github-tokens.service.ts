import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { Octokit } from '@octokit/rest'
import { readErrorMessage } from '@shared/error.util.ts'
import type { GithubAuthStatus, GithubTokenSource } from '@shared/settings.types.ts'
import { MS_PER_MINUTE } from '@shared/time.util.ts'

const ORG_SCOPE = /^(?:read|write|admin):org$/u

type Candidate = [GithubTokenSource, () => string | undefined | Promise<string | undefined>]

/** Who a token belongs to and what it may do. Throws when GitHub rejects it. */
async function inspectToken(token: string): Promise<Pick<GithubAuthStatus, 'login' | 'scopes' | 'canSeeTeams'>> {
  const res = await new Octokit({ auth: token, userAgent: 'revio' }).request('GET /user')
  const scopes = parseScopes(res.headers['x-oauth-scopes'])
  return {
    login: res.data.login,
    scopes,
    canSeeTeams: scopes?.some((scope) => ORG_SCOPE.test(scope)) ?? null,
  }
}

const isResolvedToken = (value: unknown): value is ResolvedToken =>
  typeof value === 'object' && value !== null && 'token' in value

const buildFailedStatus = (source: GithubTokenSource, err: unknown): GithubAuthStatus => ({
  source,
  login: null,
  scopes: null,
  canSeeTeams: null,
  error: readErrorMessage(err),
})

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
  /** For tests; defaults to Date.now. */
  now?: () => number
}

/**
 * How long a token from the GitHub CLI is reused. Every GitHub call resolves the token, and asking `gh` costs a
 * process launch, so the answer is kept briefly; a new `gh auth login` still applies within a minute.
 */
export const CLI_TOKEN_TTL_MS = MS_PER_MINUTE

/** The GitHub token in use, what it can do, and saving a pasted one. */
export class GithubTokens {
  readonly #sources: TokenSources
  #cliToken: { token: string; at: number } | null = null

  constructor(sources: TokenSources) {
    this.#sources = sources
  }

  /** Settings first, then .env (from source only), then GH_TOKEN / GITHUB_TOKEN, then the GitHub CLI login. */
  async resolve(): Promise<ResolvedToken> {
    for (const [source, read] of this.#candidates()) {
      // biome-ignore lint/performance/noAwaitInLoops: sources are tried in order and the first token wins; later ones (the gh CLI) must not run.
      const token = await read()
      if (token) {
        return { token, source }
      }
    }
    throw new Error('No GitHub token. Run `gh auth login`, or paste a token in Settings.')
  }

  async describe(): Promise<GithubAuthStatus> {
    const resolved = await this.resolve().catch((err: unknown) => err)
    if (!isResolvedToken(resolved)) {
      return buildFailedStatus('none', resolved)
    }
    return inspectToken(resolved.token).then(
      (details) => ({ source: resolved.source, ...details }),
      (err: unknown) => buildFailedStatus(resolved.source, err),
    )
  }

  /** Checks the token with GitHub before storing it, so a bad paste never replaces a working setup. */
  async verifyAndSave(raw: string): Promise<void> {
    const token = raw.trim()
    if (!token) {
      throw new Error('Paste a token first.')
    }
    await inspectToken(token).catch((err: unknown) => {
      throw new Error(`GitHub rejected this token: ${readErrorMessage(err)}`)
    })
    this.#sources.save(token)
  }

  #candidates(): Candidate[] {
    const sources = this.#sources
    return [
      ['settings', sources.readSaved],
      ['dotenv', () => readDotEnvToken(sources.dotEnvPath)],
      ['GH_TOKEN', () => sources.env.GH_TOKEN],
      ['GITHUB_TOKEN', () => sources.env.GITHUB_TOKEN],
      ['gh-cli', () => this.#readCliToken()],
    ]
  }

  /** The CLI's token, reused for CLI_TOKEN_TTL_MS. Failures are not kept, so a later login is picked up at once. */
  async #readCliToken(): Promise<string | undefined> {
    const now = this.#sources.now ?? Date.now
    if (this.#cliToken && now() - this.#cliToken.at < CLI_TOKEN_TTL_MS) {
      return this.#cliToken.token
    }
    const token = await this.#sources.readCliToken().catch(() => '')
    if (!token) {
      this.#cliToken = null
      return undefined
    }
    this.#cliToken = { token, at: now() }
    return token
  }
}

/** GH_TOKEN or GITHUB_TOKEN from a .env file, read on every call so edits apply on the next poll. */
export function readDotEnvToken(path: string | null): string | undefined {
  if (!path) {
    return undefined
  }
  try {
    const vars = parseEnv(readFileSync(path, 'utf8'))
    return vars.GH_TOKEN?.trim() || vars.GITHUB_TOKEN?.trim() || undefined
  } catch {
    return undefined
  }
}

/** Classic tokens list their scopes in a header; fine-grained tokens send none (null = unknown). */
export function parseScopes(header: string | undefined): string[] | null {
  if (header === undefined) {
    return null
  }
  return header
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
}
