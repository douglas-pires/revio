import { describe, expect, it } from 'vitest'
import { type ApprovedCandidate, looksLikeFix, type MergedPull, matchFollowUps } from './follow-ups.util.ts'

const merged = (number: number, title: string, mergedAt: string, files: string[]): MergedPull => ({
  repo: 'acme/web',
  number,
  title,
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

describe('looksLikeFix', () => {
  it.each([
    ['fix(cart): keep the total', true],
    ['Revert "feat: new checkout"', true],
    ['Hotfix for the login crash', true],
    ['feat: prefix the IDs', false],
  ])('%j → %s', (title, expected) => expect(looksLikeFix(title)).toBe(expected))
})

describe('matchFollowUps', () => {
  const original = merged(10, 'feat: new checkout', '2026-09-02T00:00:00Z', ['src/cart.ts', 'pnpm-lock.yaml'])

  it('finds a later fix that names the PR, and fixes of its files soon after', () => {
    const revert = merged(14, 'Revert "feat: new checkout"', '2026-12-01T00:00:00Z', ['src/cart.ts'])
    const sameFiles = merged(12, 'fix: cart total rounding', '2026-09-20T00:00:00Z', ['src/cart.ts'])
    const [pull] = matchFollowUps([approved(original, [revert])], [sameFiles, revert])
    expect(pull?.followUps.map((followUp) => [followUp.number, followUp.reason, followUp.sharedFiles])).toEqual([
      [12, 'same-files', ['src/cart.ts']],
      [14, 'mentions', ['src/cart.ts']],
    ])
  })

  it('ignores lockfiles, features, fixes from before, and fixes long after that do not name it', () => {
    const fixes = [
      merged(11, 'fix: bump deps', '2026-09-05T00:00:00Z', ['pnpm-lock.yaml']),
      merged(9, 'fix: cart', '2026-08-30T00:00:00Z', ['src/cart.ts']),
      merged(20, 'fix: cart', '2027-01-30T00:00:00Z', ['src/cart.ts']),
    ]
    const mentions = [merged(13, 'feat: build on #10', '2026-09-10T00:00:00Z', ['src/cart.ts'])]
    expect(matchFollowUps([approved(original, mentions)], fixes)).toEqual([])
  })
})
