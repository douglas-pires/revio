import { describe, expect, it, vi } from 'vitest'
import type { Octokit } from '@octokit/rest'
import { StackFinder } from '../src/main/stacks'
import { summaryToMini, type MiniPr } from '../src/main/stackGraph'
import { makeMiniPr, makeSummary } from './fixtures'

vi.mock('../src/main/github', () => ({
  gh: vi.fn(),
  splitRepo: (full: string) => {
    const [owner = '', repo = ''] = full.split('/')
    return { owner, repo }
  },
}))

/** A fake GitHub that answers the aliased pullRequests(headRefName|baseRefName: …) lookups from a list of open PRs. */
function makeFakeGithub(open: MiniPr[]) {
  const graphql = vi.fn(async (query: string) => {
    const data: Record<string, { pullRequests: { nodes: MiniPr[] } }> = {}
    const lookup = /(l\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\) \{\s*pullRequests\((headRefName|baseRefName): ("[^"]+")/g
    for (const [, alias, owner, name, field, ref] of query.matchAll(lookup)) {
      const branch = JSON.parse(ref!) as string
      const nodes = open.filter((p) => p.repository.nameWithOwner === `${owner}/${name}` && p[field as 'headRefName'] === branch)
      data[alias!] = { pullRequests: { nodes } }
    }
    return data
  })
  return { octokit: { graphql } as unknown as Octokit, graphql }
}

const a = makeSummary({ id: 'PR_1', number: 1, headRef: 'a', baseRef: 'main' })
const b = makeSummary({ id: 'PR_2', number: 2, headRef: 'b', baseRef: 'a' })

describe('StackFinder', () => {
  it('walks up and down from a PR in the middle, through PRs outside the inbox', async () => {
    const { octokit } = makeFakeGithub([summaryToMini(a), summaryToMini(b), makeMiniPr(3, 'c', 'b'), makeMiniPr(4, 'd', 'c')])
    const requested = [{ ...b }]
    const [stack] = await new StackFinder().stacksForInbox(octokit, requested, [])
    expect(stack!.nodes.map((n) => [n.pr.number, n.pr.inbox])).toEqual([
      [1, null],
      [2, 'requested'],
      [3, null],
      [4, null],
    ])
    expect(requested[0]!.stack).toEqual({ id: 'acme/web#1', position: 2, size: 4 })
  })

  it('batches many lookups into queries of at most 40', async () => {
    const seeds = Array.from({ length: 30 }, (_, i) => makeSummary({ id: `PR_${i + 10}`, number: i + 10, headRef: `h${i}`, baseRef: `b${i}` }))
    const { octokit, graphql } = makeFakeGithub([])
    await new StackFinder().stacksForInbox(octokit, seeds, [])
    expect(graphql).toHaveBeenCalledTimes(2)
    expect(graphql.mock.calls.map(([q]) => q.match(/pullRequests\(/g)!.length)).toEqual([40, 20])
  })

  it('reuses the last walk while the inbox branches are unchanged, but refreshes tags', async () => {
    const { octokit, graphql } = makeFakeGithub([summaryToMini(a), summaryToMini(b)])
    const finder = new StackFinder()
    await finder.stacksForInbox(octokit, [{ ...b }], [{ ...a }])
    const calls = graphql.mock.calls.length
    const stacks = await finder.stacksForInbox(octokit, [{ ...b, stale: true }], [{ ...a }])
    expect(graphql.mock.calls.length).toBe(calls)
    expect(stacks[0]!.nodes[1]!.pr.stale).toBe(true)

    await finder.stacksForInbox(octokit, [{ ...b, baseRef: 'main' }], [{ ...a }])
    expect(graphql.mock.calls.length).toBeGreaterThan(calls)
  })

  it('falls back to the cached stacks when GitHub fails', async () => {
    const { octokit, graphql } = makeFakeGithub([summaryToMini(a), summaryToMini(b)])
    const finder = new StackFinder()
    await finder.stacksForInbox(octokit, [{ ...b }], [{ ...a }])
    graphql.mockRejectedValue(new Error('rate limited'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const stacks = await finder.stacksForInbox(octokit, [{ ...b, reviewDecision: 'APPROVED' }], [{ ...a }])
    expect(stacks).toHaveLength(1)
  })
})
