import type { Commit } from '@shared/git-log.types.ts'
import { describe, expect, it } from 'vitest'
import { NO_FILTERS } from '../gitlog/log-filters.types.ts'
import {
  clampPanelHeight,
  filterByMessage,
  listPathSuggestions,
  MIN_PANEL_HEIGHT_PX,
  prepareLogCommits,
  readHashQuery,
  readMessageQuery,
  skipsCommits,
} from './pull-git-log.util.ts'

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

describe('message and hash searches', () => {
  it('sends a hash to GitHub and matches anything else against the messages', () => {
    expect(readHashQuery('a1b2c3d')).toBe('a1b2c3d')
    expect(readMessageQuery('a1b2c3d')).toBe('')
    expect(readHashQuery('fix login')).toBe('')
    expect(readMessageQuery(' fix login ')).toBe('fix login')
  })

  it('keeps the commits whose subject fuzzily matches, in log order', () => {
    const commits = [commit('c'), commit('b'), commit('a')].map((row, index) => ({
      ...row,
      subject: ['Fix login redirect', 'Docs', 'feat: fix the login form'][index] ?? '',
    }))
    expect(filterByMessage(commits, 'fixlogin').map((row) => row.hash)).toEqual(['c', 'a'])
    expect(filterByMessage(commits, '')).toHaveLength(3)
  })
})

describe('listPathSuggestions', () => {
  it('lists the files, then each folder that holds them once', () => {
    expect(listPathSuggestions(['src/main/a.ts', 'src/main/b.ts', 'README.md'])).toEqual([
      'src/main/a.ts',
      'src/main/b.ts',
      'README.md',
      'src',
      'src/main',
    ])
  })
})
