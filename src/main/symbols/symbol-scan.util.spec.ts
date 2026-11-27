import { describe, expect, it } from 'vitest'
import { isDefinitionLine, isSearchableName, scanFile, sortHits } from './symbol-scan.util.ts'

describe('isDefinitionLine', () => {
  it.each([
    ['export function chargeCard(order: Order) {', true],
    ['export const chargeCard = async (order) => {', true],
    ['class chargeCard {', true],
    ['  async chargeCard(order: Order): Promise<void> {', true],
    ['  chargeCard: (order) => gateway.charge(order),', true],
    ['def chargeCard(order):', true],
    ['  await chargeCard(order)', false],
    ['import { chargeCard } from "./charge"', false],
    ['if (chargeCard(order)) {', false],
  ])('%j → %s', (line, expected) => expect(isDefinitionLine(line, 'chargeCard')).toBe(expected))
})

describe('isSearchableName', () => {
  it('takes identifiers, not punctuation or one letter', () => {
    expect([
      isSearchableName('chargeCard'),
      isSearchableName('$el'),
      isSearchableName('a'),
      isSearchableName('a.b'),
    ]).toEqual([true, true, false, false])
  })
})

describe('scanFile', () => {
  const content = [
    'import { total } from "./total"',
    '',
    'export function total(items) {',
    '  return subtotal(items)',
    '}',
    'total(cart)',
  ].join('\n')

  it('finds whole-word mentions with their line and context, and tells definitions from uses', () => {
    const hits = scanFile('cart.ts', content, 'total', true)
    expect(hits.map((hit) => [hit.line, hit.kind])).toEqual([
      [1, 'usage'],
      [3, 'definition'],
      [6, 'usage'],
    ])
    expect(hits[1]?.contextStart).toBe(1)
    expect(hits[1]?.context).toHaveLength(6)
  })

  it('puts definitions first, then the PR’s files', () => {
    const hits = [...scanFile('b.ts', 'total(x)', 'total', false), ...scanFile('a.ts', content, 'total', true)]
    expect(sortHits(hits).map((hit) => `${hit.path}:${hit.line}`)).toEqual(['a.ts:3', 'a.ts:1', 'a.ts:6', 'b.ts:1'])
  })
})
