import type { Stack, StackPr } from '@shared/inbox.types.ts'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  findKnownStack,
  findKnownStackPr,
  forgetStackMemory,
  readStackScroll,
  readStackTab,
  rememberStack,
  rememberStackScroll,
  rememberStackTab,
} from '@/pull/stack-memory.util.ts'

function makeStackPr(number: number): StackPr {
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

const makeStack = (id: string, ...numbers: number[]): Stack => ({
  id,
  repo: 'acme/web',
  base: 'main',
  nodes: numbers.map((number) => ({ pr: makeStackPr(number), depth: 0 })),
})

const makeRef = (number: number) => ({ repo: 'acme/web', number })

describe('stack memory', () => {
  beforeEach(forgetStackMemory)

  it('knows the stack and the PR for a PR in the remembered stack only', () => {
    rememberStack(makeStack('s1', 1, 2, 3))
    expect(findKnownStack(makeRef(3))?.id).toBe('s1')
    expect(findKnownStackPr(makeRef(2))?.title).toBe('PR 2')
    expect(findKnownStack(makeRef(9))).toBeNull()
    expect(findKnownStack({ repo: 'acme/other', number: 1 })).toBeNull()
  })

  it('keeps the scroll and tab while moving within one stack', () => {
    rememberStack(makeStack('s1', 1, 2))
    rememberStackScroll(makeStack('s1', 1, 2), 140)
    rememberStackTab(makeRef(1), 'files')
    rememberStack(makeStack('s1', 1, 2))
    expect(readStackScroll(makeStack('s1', 1, 2))).toBe(140)
    expect(readStackTab(makeRef(2))).toBe('files')
  })

  it('starts over in another stack', () => {
    rememberStack(makeStack('s1', 1, 2))
    rememberStackScroll(makeStack('s1', 1, 2), 140)
    rememberStackTab(makeRef(1), 'files')
    rememberStack(makeStack('s2', 7, 8))
    expect(readStackScroll(makeStack('s2', 7, 8))).toBe(0)
    expect(readStackTab(makeRef(8))).toBeNull()
    expect(readStackTab(makeRef(1))).toBeNull()
  })
})
