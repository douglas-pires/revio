import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CLI_TOKEN_TTL_MS, GithubTokens, parseScopes, readDotEnvToken, type TokenSources } from './github-tokens.service'

describe('parseScopes', () => {
  it('splits a classic token scope header', () => {
    expect(parseScopes('repo, read:org,  gist')).toEqual(['repo', 'read:org', 'gist'])
  })

  it('returns an empty list for a classic token with no scopes', () => {
    expect(parseScopes('')).toEqual([])
  })

  it('returns null for fine-grained tokens, which send no scope header', () => {
    expect(parseScopes(undefined)).toBeNull()
  })
})

const writeDotEnv = (text: string) => {
  const path = join(mkdtempSync(join(tmpdir(), 'revio-')), '.env')
  writeFileSync(path, text)
  return path
}

describe('readDotEnvToken', () => {
  it('reads GH_TOKEN before GITHUB_TOKEN, and nothing without a file', () => {
    expect(readDotEnvToken(writeDotEnv('GITHUB_TOKEN=b\nGH_TOKEN=a\n'))).toBe('a')
    expect(readDotEnvToken(writeDotEnv('GITHUB_TOKEN="b"\n'))).toBe('b')
    expect(readDotEnvToken(null)).toBeUndefined()
    expect(readDotEnvToken('/no/such/.env')).toBeUndefined()
  })
})

describe('GithubTokens.resolve', () => {
  const makeSources = (over: Partial<TokenSources> = {}): TokenSources => ({
    readSaved: () => undefined, save: vi.fn(), dotEnvPath: null, env: {}, readCliToken: async () => '', ...over,
  })

  it.each([
    [{ readSaved: () => 'saved', dotEnvPath: writeDotEnv('GITHUB_TOKEN=file'), env: { GITHUB_TOKEN: 'env' } }, 'settings'],
    [{ dotEnvPath: writeDotEnv('GITHUB_TOKEN=file'), env: { GITHUB_TOKEN: 'env' } }, 'dotenv'],
    [{ env: { GH_TOKEN: 'gh', GITHUB_TOKEN: 'env' } }, 'GH_TOKEN'],
    [{ env: { GITHUB_TOKEN: 'env' } }, 'GITHUB_TOKEN'],
    [{ readCliToken: async () => 'cli' }, 'gh-cli'],
  ] as const)('picks the first available source (%#)', async (over, source) => {
    expect((await new GithubTokens(makeSources(over)).resolve()).source).toBe(source)
  })

  it('fails with guidance when there is no token, even if the CLI errors', async () => {
    const tokens = new GithubTokens(makeSources({ readCliToken: () => Promise.reject(new Error('no gh')) }))
    await expect(tokens.resolve()).rejects.toThrow('gh auth login')
  })

  it('asks the CLI once per minute, and again right away after a failure', async () => {
    let clock = 0
    const readCliToken = vi.fn().mockRejectedValueOnce(new Error('not logged in')).mockResolvedValue('cli')
    const tokens = new GithubTokens(makeSources({ readCliToken, now: () => clock }))
    await expect(tokens.resolve()).rejects.toThrow()
    expect((await tokens.resolve()).token).toBe('cli')
    clock = CLI_TOKEN_TTL_MS - 1
    await tokens.resolve()
    expect(readCliToken).toHaveBeenCalledTimes(2)
    clock = CLI_TOKEN_TTL_MS
    await tokens.resolve()
    expect(readCliToken).toHaveBeenCalledTimes(3)
  })

  it('refuses an empty paste without calling GitHub or saving', async () => {
    const sources = makeSources()
    await expect(new GithubTokens(sources).verifyAndSave('   ')).rejects.toThrow('Paste a token first.')
    expect(sources.save).not.toHaveBeenCalled()
  })
})
