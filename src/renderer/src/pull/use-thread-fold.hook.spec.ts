import { describe, expect, it } from 'vitest'
import { threadFolded, withThreadFolded } from '@/pull/use-thread-fold.hook.ts'

const open = { all: false, flipped: new Set<number>(), revealed: new Set<number>() }
const allFolded = { ...open, all: true }

describe('thread folding', () => {
  it('follows the overall choice', () => {
    expect(threadFolded(open, [1, 2])).toBe(false)
    expect(threadFolded(allFolded, [1, 2])).toBe(true)
  })

  it('minimises or opens one thread against the overall choice', () => {
    const one = withThreadFolded(open, [1, 2], true)
    expect(threadFolded(one, [1, 2])).toBe(true)
    expect(threadFolded(one, [5])).toBe(false)
    const back = withThreadFolded(one, [1, 2], false)
    expect(threadFolded(back, [1, 2])).toBe(false)
    const opened = withThreadFolded(allFolded, [5], false)
    expect(threadFolded(opened, [5])).toBe(false)
    expect(threadFolded(opened, [1, 2])).toBe(true)
  })

  it('keeps a thread open once you jump to one of its comments, until you minimise it again', () => {
    const jumped = { ...allFolded, revealed: new Set([2]) }
    expect(threadFolded(jumped, [1, 2])).toBe(false)
    expect(threadFolded(withThreadFolded(jumped, [1, 2], true), [1, 2])).toBe(true)
  })
})
