import { describe, expect, it } from 'vitest'
import { isThreadFolded, setThreadFolded } from '@/pull/use-thread-fold.hook.ts'

const open = { all: false, flipped: new Set<number>(), revealed: new Set<number>() }
const allFolded = { ...open, all: true }

describe('thread folding', () => {
  it('follows the overall choice', () => {
    expect(isThreadFolded(open, [1, 2])).toBe(false)
    expect(isThreadFolded(allFolded, [1, 2])).toBe(true)
  })

  it('minimises or opens one thread against the overall choice', () => {
    const one = setThreadFolded(open, [1, 2], true)
    expect(isThreadFolded(one, [1, 2])).toBe(true)
    expect(isThreadFolded(one, [5])).toBe(false)
    const back = setThreadFolded(one, [1, 2], false)
    expect(isThreadFolded(back, [1, 2])).toBe(false)
    const opened = setThreadFolded(allFolded, [5], false)
    expect(isThreadFolded(opened, [5])).toBe(false)
    expect(isThreadFolded(opened, [1, 2])).toBe(true)
  })

  it('keeps a thread open once you jump to one of its comments, until you minimise it again', () => {
    const jumped = { ...allFolded, revealed: new Set([2]) }
    expect(isThreadFolded(jumped, [1, 2])).toBe(false)
    expect(isThreadFolded(setThreadFolded(jumped, [1, 2], true), [1, 2])).toBe(true)
  })
})
