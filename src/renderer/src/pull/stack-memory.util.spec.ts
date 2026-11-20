import type { Stack, StackPr } from '@shared/inbox.types.ts'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  forgetStackMemory,
  knownStackOf,
  knownStackPr,
  rememberStack,
  rememberStackScroll,
  rememberStackTab,
  stackScrollOf,
  stackTabFor,
} from '@/pull/stack-memory.util.ts'

function pr(number: number): StackPr {
  return {
    id: `PR_${number}`,
    number,
    title: `PR ${number}`,
    url: '',
    repo: 'acme/web',
    author: 'jonas',
    authorAvatar: '',
    headRef: `b${number}`,
    baseRef: 'main',
    isDraft: false,
    reviewDecision: null,
    inbox: null,
    stale: false,
  }
}

const stack = (id: string, ...numbers: number[]): Stack => ({
  id,
  repo: 'acme/web',
  base: 'main',
  nodes: numbers.map((n) => ({ pr: pr(n), depth: 0 })),
})

const ref = (number: number) => ({ repo: 'acme/web', number })

describe('stack memory', () => {
  beforeEach(forgetStackMemory)

  it('knows the stack and the PR for a PR in the remembered stack only', () => {
    rememberStack(stack('s1', 1, 2, 3))
    expect(knownStackOf(ref(3))?.id).toBe('s1')
    expect(knownStackPr(ref(2))?.title).toBe('PR 2')
    expect(knownStackOf(ref(9))).toBeNull()
    expect(knownStackOf({ repo: 'acme/other', number: 1 })).toBeNull()
  })

  it('keeps the scroll and tab while moving within one stack', () => {
    rememberStack(stack('s1', 1, 2))
    rememberStackScroll(stack('s1', 1, 2), 140)
    rememberStackTab(ref(1), 'files')
    rememberStack(stack('s1', 1, 2))
    expect(stackScrollOf(stack('s1', 1, 2))).toBe(140)
    expect(stackTabFor(ref(2))).toBe('files')
  })

  it('starts over in another stack', () => {
    rememberStack(stack('s1', 1, 2))
    rememberStackScroll(stack('s1', 1, 2), 140)
    rememberStackTab(ref(1), 'files')
    rememberStack(stack('s2', 7, 8))
    expect(stackScrollOf(stack('s2', 7, 8))).toBe(0)
    expect(stackTabFor(ref(8))).toBeNull()
    expect(stackTabFor(ref(1))).toBeNull()
  })
})
