import type { Commit } from '@shared/git-log.types.ts'
import { describe, expect, it } from 'vitest'
import { NO_FILTERS } from '../gitlog/log-filters.types.ts'
import { clampPanelHeight, MIN_PANEL_HEIGHT_PX, prepareLogCommits, skipsCommits } from './pull-git-log.util.ts'

const commit = (hash: string, ...parents: string[]): Commit => ({
  hash,
  parents,
  author: 'ana',
  authorEmail: '',
  date: '',
  subject: hash,
  refs: [],
})

describe('clampPanelHeight', () => {
  it('keeps the height between the minimum and three quarters of the window', () => {
    expect(clampPanelHeight(400, 1000)).toBe(400)
    expect(clampPanelHeight(20, 1000)).toBe(MIN_PANEL_HEIGHT_PX)
    expect(clampPanelHeight(900, 1000)).toBe(750)
  })

  it('never goes under the minimum, even in a short window', () => {
    expect(clampPanelHeight(400, 100)).toBe(MIN_PANEL_HEIGHT_PX)
  })
})

describe('skipsCommits', () => {
  it('is true for path, author and message filters, not for a date alone', () => {
    expect(skipsCommits({ ...NO_FILTERS, path: 'src/a.ts' })).toBe(true)
    expect(skipsCommits({ ...NO_FILTERS, author: 'ana' })).toBe(true)
    expect(skipsCommits({ ...NO_FILTERS, sinceDays: 7 })).toBe(false)
  })
})

describe('prepareLogCommits', () => {
  it('keeps the real parents of an unfiltered history and labels the head with the PR branch', () => {
    const prepared = prepareLogCommits([commit('m', 'b', 'f'), commit('b', 'a')], {
      skipsCommits: false,
      headSha: 'm',
      headRef: 'feat/x',
    })
    expect(prepared.map((row) => row.parents)).toEqual([['b', 'f'], ['a']])
    expect(prepared[0]?.refs).toEqual(['feat/x'])
    expect(prepared[1]?.refs).toEqual([])
  })

  it('links each commit of a filtered history to the next one shown', () => {
    const prepared = prepareLogCommits([commit('c', 'x'), commit('b', 'y'), commit('a', 'z')], {
      skipsCommits: true,
      headSha: 'h',
      headRef: 'feat/x',
    })
    expect(prepared.map((row) => row.parents)).toEqual([['b'], ['a'], []])
  })
})
