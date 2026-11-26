import { describe, expect, it } from 'vitest'
import {
  type ApprovedCandidate,
  findExplicitLink,
  findLinkedFixes,
  listLineChecks,
  looksLikeFix,
  type MergedPull,
} from './follow-ups.util.ts'

const merged = (number: number, title: string, mergedAt: string, files: string[]): MergedPull => ({
  repo: 'acme/web',
  number,
  title,
  body: '',
  url: `https://github.com/acme/web/pull/${number}`,
  author: 'bo',
  mergedAt,
  files,
})

const approved = (pull: MergedPull, mentionedBy: MergedPull[] = []): ApprovedCandidate => ({
  ...pull,
  approvedAt: '2026-09-01T00:00:00Z',
  mentionedBy,
})

const original = merged(10, 'feat: new checkout', '2026-09-02T00:00:00Z', ['src/cart.ts', 'pnpm-lock.yaml'])
const later = '2026-09-20T00:00:00Z'

describe('looksLikeFix', () => {
  it.each([
    ['fix(cart): keep the total', true],
    ['Hotfix for the login crash', true],
    ['feat: prefix the IDs', false],
  ])('%j → %s', (title, expected) => expect(looksLikeFix(title)).toBe(expected))
})

describe('findExplicitLink', () => {
  it.each([
    ['Revert "feat: new checkout"', 'This reverts acme/web#10', 'reverts'],
    ['fix: totals', 'Fixes #10', 'says-fixes'],
    ['fix: totals', 'Regression from https://github.com/acme/web/pull/10', 'says-fixes'],
    ['fix(cart): keep the total (#10)', '', 'says-fixes'],
    ['feat: build on the checkout', 'Follows #10', null],
    ['fix: totals', 'See #10 for context', null],
    ['fix: totals', 'Fixes #100', null],
  ])('%j / %j → %s', (title, body, expected) => {
    expect(findExplicitLink(original, { ...merged(12, title, later, []), body })).toBe(expected)
  })
})

describe('findLinkedFixes', () => {
  it('keeps later PRs that say they fix it, not those merged before it', () => {
    const fixes = findLinkedFixes(
      approved(original, [
        { ...merged(12, 'fix: totals', later, ['src/cart.ts']), body: 'Fixes #10' },
        { ...merged(9, 'fix: totals', '2026-08-01T00:00:00Z', []), body: 'Fixes #10' },
      ]),
    )
    expect([...fixes.values()].map((fix) => [fix.number, fix.reason, fix.sharedFiles])).toEqual([
      [12, 'says-fixes', ['src/cart.ts']],
    ])
  })
})

describe('listLineChecks', () => {
  it('compares only fixes of the same real files within 60 days that are not already linked', () => {
    const statedFix = { ...merged(14, 'fix: cart', later, ['src/cart.ts']), body: 'Fixes #10' }
    const candidate = approved(original, [statedFix])
    const fixes = [
      merged(11, 'fix: deps', later, ['pnpm-lock.yaml']),
      merged(12, 'fix: cart', later, ['src/cart.ts']),
      merged(13, 'fix: cart', '2026-12-30T00:00:00Z', ['src/cart.ts']),
      statedFix,
    ]
    expect(listLineChecks(candidate, fixes, findLinkedFixes(candidate)).map((check) => check.fix.number)).toEqual([12])
  })
})
