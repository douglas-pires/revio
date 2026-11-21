import { describe, expect, it } from 'vitest'
import { assertPresent, makeMiniPr, makeSummary } from '../../../test/fixtures.ts'
import { applyInboxTags, buildStacks, markStackPositions, tagInbox } from './stack-graph.util.ts'

const noTags = tagInbox([], [])
const noStale = new Set<string>()
// main ← a (#1) ← b (#2) ← c (#3), and a second child of a: d (#4)
const chain = [makeMiniPr(3, 'c', 'b'), makeMiniPr(4, 'd', 'a'), makeMiniPr(1, 'a', 'main'), makeMiniPr(2, 'b', 'a')]

describe('buildStacks', () => {
  it('orders a stack bottom-up, each PR followed by the PRs stacked on it', () => {
    const [stack, ...rest] = buildStacks(chain, new Set(['PR_2']), noTags, noStale)
    expect(rest).toEqual([])
    expect(stack?.id).toBe('acme/web#1')
    expect(stack?.base).toBe('main')
    expect(stack?.nodes.map((node) => [node.pr.number, node.depth])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 1],
    ])
  })

  it('orders sibling PRs by number', () => {
    const prs = [makeMiniPr(1, 'a', 'main'), makeMiniPr(6, 'x', 'a'), makeMiniPr(4, 'y', 'a'), makeMiniPr(5, 'z', 'a')]
    const [stack] = buildStacks(prs, new Set(['PR_1']), noTags, noStale)
    expect(stack?.nodes.map((node) => node.pr.number)).toEqual([1, 4, 5, 6])
  })

  it("does not stack PRs on a fork PR opened from the fork's main branch", () => {
    const forkFromMain = makeMiniPr(7, 'main', 'main')
    expect(buildStacks([forkFromMain, makeMiniPr(8, 'f', 'main')], new Set(['PR_7', 'PR_8']), noTags, noStale)).toEqual(
      [],
    )
  })

  it('does not make a PR its own parent', () => {
    const odd = makeMiniPr(9, 'x', 'x')
    expect(buildStacks([odd, makeMiniPr(10, 'y', 'x')], new Set(['PR_9']), noTags, noStale).map((st) => st.id)).toEqual(
      ['acme/web#9'],
    )
  })

  it('drops stacks that contain no seed, and single PRs', () => {
    expect(buildStacks(chain, new Set(['PR_99']), noTags, noStale)).toEqual([])
    expect(buildStacks([makeMiniPr(9, 'solo', 'main')], new Set(['PR_9']), noTags, noStale)).toEqual([])
  })

  it('does not link same-named branches across repositories', () => {
    const prs = [makeMiniPr(1, 'a', 'main'), makeMiniPr(5, 'b2', 'a', 'acme/api')]
    expect(buildStacks(prs, new Set(['PR_5']), noTags, noStale)).toEqual([])
  })

  it('tags inbox membership and staleness', () => {
    const [stack] = buildStacks(
      chain.slice(2),
      new Set(['PR_1']),
      tagInbox([{ id: 'PR_2' }], [{ id: 'PR_1' }]),
      new Set(['PR_2']),
    )
    expect(stack?.nodes.map((node) => [node.pr.number, node.pr.inbox, node.pr.stale])).toEqual([
      [1, 'reviewed', false],
      [2, 'requested', true],
    ])
  })
})

describe('markStackPositions and withInboxTags', () => {
  const stack = assertPresent(buildStacks(chain.slice(2), new Set(['PR_1']), noTags, noStale)[0])

  it('sets 1-based positions from the bottom on summaries in a stack', () => {
    const prs = [makeSummary({ id: 'PR_2' }), makeSummary({ id: 'PR_7' })]
    markStackPositions([stack], prs)
    expect(prs.map((pr) => pr.stack)).toEqual([{ id: 'acme/web#1', position: 2, size: 2 }, undefined])
  })

  it('refreshes tags on cached stacks without changing them', () => {
    const fresh = applyInboxTags([stack], [makeSummary({ id: 'PR_2', stale: true })], [])
    expect(fresh[0]?.nodes.map((node) => [node.pr.inbox, node.pr.stale])).toEqual([
      [null, false],
      ['requested', true],
    ])
    expect(stack?.nodes[1]?.pr.inbox).toBeNull()
  })
})
