import type { Octokit } from '@octokit/rest'
import { describe, expect, it, vi } from 'vitest'
import { makeDetail, makeFile } from '../../../test/fixtures.ts'
import { findSymbol } from './symbol-search.service.ts'

const files: Record<string, string> = {
  'src/cart.ts': 'export function total(items) {\n  return sum(items)\n}',
  'src/page.ts': 'const shown = total(cart)',
  'src/other.ts': 'import { total } from "./cart"\ntotal(order.items)',
}
const loadFile = (_repo: string, _ref: string, path: string) => Promise.resolve(files[path] ?? null)
const pr = makeDetail({ files: [makeFile({ path: 'src/cart.ts' }), makeFile({ path: 'src/page.ts' })] })

describe('findSymbol', () => {
  it('reads the PR’s files and the files code search finds, at the PR’s head', async () => {
    const code = vi.fn().mockResolvedValue({ data: { items: [{ path: 'src/other.ts' }, { path: 'src/cart.ts' }] } })
    const octokit = { search: { code } } as unknown as Octokit
    const found = await findSymbol({ octokit, pr, name: 'total', loadFile })
    expect(found.hits.map((hit) => [hit.kind, `${hit.path}:${hit.line}`, hit.inPull])).toEqual([
      ['definition', 'src/cart.ts:1', true],
      ['usage', 'src/page.ts:1', true],
      ['usage', 'src/other.ts:1', false],
      ['usage', 'src/other.ts:2', false],
    ])
    expect(found.note).toBeNull()
  })

  it('keeps the PR’s hits and says why when code search is rate-limited', async () => {
    const limited = Object.assign(new Error('rate limited'), { status: 403 })
    const octokit = { search: { code: vi.fn().mockRejectedValue(limited) } } as unknown as Octokit
    const found = await findSymbol({ octokit, pr, name: 'total', loadFile })
    expect(found.hits).toHaveLength(2)
    expect(found.note).toContain('limits code search')
  })

  it('refuses something that is not a name', async () => {
    await expect(findSymbol({ octokit: {} as Octokit, pr, name: 'a b', loadFile })).rejects.toThrow('not a name')
  })
})
