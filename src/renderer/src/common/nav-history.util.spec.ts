import { describe, expect, it } from 'vitest'
import { canGoBack, canGoForward, readCurrentEntry, startHistory, step, visit } from './nav-history.util.ts'

const same = (left: string, right: string) => left === right

describe('nav history', () => {
  it('goes back and forward through visited screens', () => {
    let history = visit(visit(startHistory('inbox'), 'pr', same), 'settings', same)
    history = step(history, -1)
    expect(readCurrentEntry(history)).toBe('pr')
    expect(canGoForward(history)).toBe(true)
    history = step(history, 1)
    expect(readCurrentEntry(history)).toBe('settings')
    expect(canGoForward(history)).toBe(false)
  })

  it('drops the forward screens when visiting from the middle', () => {
    let history = visit(visit(startHistory('a'), 'b', same), 'c', same)
    history = visit(step(step(history, -1), -1), 'd', same)
    expect(history.entries).toEqual(['a', 'd'])
    expect(canGoForward(history)).toBe(false)
  })

  it('ignores a visit to the current screen and steps past either end', () => {
    const history = startHistory('a')
    expect(visit(history, 'a', same)).toBe(history)
    expect(step(history, -1)).toBe(history)
    expect(step(history, 1)).toBe(history)
    expect(canGoBack(history)).toBe(false)
  })

  it('keeps the last 50 screens', () => {
    let history = startHistory('0')
    for (let visitNumber = 1; visitNumber <= 60; visitNumber += 1) {
      history = visit(history, String(visitNumber), same)
    }
    expect(history.entries).toHaveLength(50)
    expect(history.entries[0]).toBe('11')
    expect(readCurrentEntry(history)).toBe('60')
  })
})
