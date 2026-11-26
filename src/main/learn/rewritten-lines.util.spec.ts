import { describe, expect, it } from 'vitest'
import { countRewrittenLines } from './rewritten-lines.util.ts'

describe('countRewrittenLines', () => {
  const approved = {
    'cart.ts': [
      '@@ -1,2 +1,5 @@',
      "+import { round } from './math'",
      '+  const total = items.reduce(sum, 0)',
      '+  return formatMoney(total, account.currency)',
      '+}',
    ].join('\n'),
  }

  it('counts lines the approved PR added that the later one removed', () => {
    const fix = {
      'cart.ts': [
        '@@ -1,3 +1,3 @@',
        "-import { round } from './math'",
        '-  return formatMoney(total, account.currency)',
        '+  return formatMoney(total, order.currency)',
        '-}',
      ].join('\n'),
    }
    expect(countRewrittenLines(approved, fix, ['cart.ts'])).toBe(1)
  })

  it('ignores imports, short lines and files not shared', () => {
    expect(countRewrittenLines(approved, { 'cart.ts': "-import { round } from './math'\n-}" }, ['cart.ts'])).toBe(0)
    expect(countRewrittenLines(approved, { 'other.ts': '-  const total = items.reduce(sum, 0)' }, ['cart.ts'])).toBe(0)
  })
})
