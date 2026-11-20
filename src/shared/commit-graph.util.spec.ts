import { describe, expect, it } from 'vitest'
import { layoutGraph } from './commit-graph.util.ts'

const commit = (hash: string, ...parents: string[]) => ({ hash, parents })

describe('layoutGraph', () => {
  it('keeps a straight history on one lane', () => {
    const rows = layoutGraph([commit('c', 'b'), commit('b', 'a'), commit('a')])
    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0])
    expect(rows.map((row) => row.width)).toEqual([1, 1, 1])
    expect(rows[1]?.top).toEqual([{ from: 0, to: 0, color: 0 }])
    expect(rows[2]?.bottom).toEqual([])
  })

  it('opens a lane for a merged branch and closes it where the branch started', () => {
    // m merges f into main; f and b both come from a.
    const rows = layoutGraph([commit('m', 'b', 'f'), commit('f', 'a'), commit('b', 'a'), commit('a')])
    expect(rows.map((row) => row.lane)).toEqual([0, 1, 0, 0])
    // The merge draws its first parent straight down and the second off to a new lane.
    expect(rows[0]?.bottom).toEqual([
      { from: 0, to: 0, color: 0 },
      { from: 0, to: 1, color: 1 },
    ])
    // At a, both lanes meet at the dot, and the graph narrows back to one lane.
    expect(rows[3]?.top).toEqual([
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 0, color: 1 },
    ])
    expect(rows[3]?.width).toBe(2)
  })

  it('starts a new lane for a branch tip nothing waited for', () => {
    const rows = layoutGraph([commit('x', 'a'), commit('y', 'a'), commit('a')])
    expect(rows.map((row) => row.lane)).toEqual([0, 1, 0])
    expect(rows[1]?.color).not.toBe(rows[0]?.color)
  })

  it('joins a merged parent that already has a lane, keeping that lane going', () => {
    // t (tip of another branch) waits on b; then m merges b too.
    const rows = layoutGraph([commit('t', 'b'), commit('m', 'a', 'b'), commit('b', 'a'), commit('a')])
    const [, merge] = rows
    expect(merge?.lane).toBe(1)
    expect(merge?.bottom).toEqual([
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 0, color: 0 },
      { from: 1, to: 1, color: 1 },
    ])
  })
})
