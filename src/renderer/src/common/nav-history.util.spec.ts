import { describe, expect, it } from 'vitest'
import { canGoBack, canGoForward, currentEntry, startHistory, step, visit } from './nav-history.util'

const same = (a: string, b: string) => a === b

describe('nav history', () => {
  it('goes back and forward through visited screens', () => {
    let h = visit(visit(startHistory('inbox'), 'pr', same), 'settings', same)
    h = step(h, -1)
    expect(currentEntry(h)).toBe('pr')
    expect(canGoForward(h)).toBe(true)
    h = step(h, 1)
    expect(currentEntry(h)).toBe('settings')
    expect(canGoForward(h)).toBe(false)
  })

  it('drops the forward screens when visiting from the middle', () => {
    let h = visit(visit(startHistory('a'), 'b', same), 'c', same)
    h = visit(step(step(h, -1), -1), 'd', same)
    expect(h.entries).toEqual(['a', 'd'])
    expect(canGoForward(h)).toBe(false)
  })

  it('ignores a visit to the current screen and steps past either end', () => {
    const h = startHistory('a')
    expect(visit(h, 'a', same)).toBe(h)
    expect(step(h, -1)).toBe(h)
    expect(step(h, 1)).toBe(h)
    expect(canGoBack(h)).toBe(false)
  })

  it('keeps the last 50 screens', () => {
    let h = startHistory('0')
    for (let i = 1; i <= 60; i++) h = visit(h, String(i), same)
    expect(h.entries).toHaveLength(50)
    expect(h.entries[0]).toBe('11')
    expect(currentEntry(h)).toBe('60')
  })
})
