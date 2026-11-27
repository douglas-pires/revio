import { describe, expect, it } from 'vitest'
import type { Concern, DismissedConcern } from './claude.types.ts'
import { keepUndismissed } from './concern-filter.util.ts'

const concern = (title: string, path: string, line: number | null, confidence?: Concern['confidence']): Concern => ({
  title,
  detail: '',
  path,
  line,
  confidence,
})

const dismissed = (title: string, path: string, line: number | null): DismissedConcern => ({
  title,
  path,
  line,
  dismissedAt: '2026-11-26T00:00:00Z',
})

describe('keepUndismissed', () => {
  it('drops concerns you dismissed, by title or nearby line in the same file', () => {
    const kept = keepUndismissed(
      [
        concern('Missing null check!', 'cart.ts', 40),
        concern('Total may round wrong', 'cart.ts', 12),
        concern('Unrelated', 'cart.ts', 90),
        concern('Missing null check', 'other.ts', 40),
      ],
      [dismissed('missing null check', 'cart.ts', null), dismissed('Something else', 'cart.ts', 10)],
    )
    expect(kept.map((item) => `${item.path}:${item.line}`)).toEqual(['cart.ts:90', 'other.ts:40'])
  })

  it('puts the surest first, older concerns without a confidence in the middle', () => {
    const kept = keepUndismissed(
      [concern('a', 'x.ts', 1, 'low'), concern('b', 'x.ts', 20), concern('c', 'x.ts', 40, 'high')],
      [],
    )
    expect(kept.map((item) => item.title)).toEqual(['c', 'b', 'a'])
  })
})
