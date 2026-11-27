import type { ResolvedGuideline } from '@shared/guideline.types.ts'
import { describe, expect, it } from 'vitest'
import { makeDetail, makeFile } from '../../../test/fixtures.ts'
import { buildPrContext, describeDismissed } from './briefing.service.ts'

const guide: ResolvedGuideline = {
  id: 'g',
  repo: 'acme/web',
  path: 'apps/web/',
  title: 'Web rules',
  body: 'No any.',
  enabled: true,
  updatedAt: '',
  matchedFiles: 1,
}

describe('prContext', () => {
  it('fits the smallest diffs first and lists the rest as omitted', () => {
    const pr = makeDetail({
      files: [
        // In PR order, big.ts would fit first and push out both smaller files.
        makeFile({ path: 'big.ts', patch: 'x'.repeat(40) }),
        makeFile({ path: 'small.ts', patch: 'x'.repeat(10) }),
        makeFile({ path: 'mid.ts', patch: 'x'.repeat(30) }),
        makeFile({ path: 'image.png', patch: undefined }),
      ],
    })
    const { context, omitted } = buildPrContext(pr, [], 50)
    expect(omitted.toSorted((left, right) => left.localeCompare(right))).toEqual(['big.ts', 'image.png'])
    expect(context).toContain('<file path="small.ts"')
    expect(context).toContain('<file path="mid.ts"')
    expect(context).not.toContain('<file path="big.ts"')
    expect(context).toContain('(none configured)')
  })

  it('includes scoped guidelines, the description and existing comments', () => {
    const pr = makeDetail({
      body: 'Fixes login.',
      comments: [
        {
          id: 1,
          path: 'src/a.ts',
          line: 3,
          startLine: null,
          side: 'RIGHT',
          body: 'why?',
          author: 'bo',
          authorAvatar: '',
          createdAt: '',
          url: '',
          outdated: false,
          subjectType: 'line',
          nodeId: 'N1',
          reactions: [],
        },
      ],
    })
    const { context } = buildPrContext(pr, [guide])
    expect(context).toContain('<guideline title="Web rules" scope="acme/web › apps/web/">\nNo any.\n</guideline>')
    expect(context).toContain('Fixes login.')
    expect(context).toContain('- bo on src/a.ts:3: why?')
    expect(context).not.toContain('<omitted_diffs')
  })
})

describe('describeDismissed', () => {
  it('lists the concerns you dismissed for Claude, or nothing', () => {
    expect(describeDismissed([])).toBe('')
    const text = describeDismissed([
      { title: 'Missing null check', path: 'cart.ts', line: 12, dismissedAt: '' },
      { title: 'Too long', path: 'page.ts', line: null, dismissedAt: '' },
    ])
    expect(text).toContain('- Missing null check (cart.ts:12)')
    expect(text).toContain('- Too long (page.ts)')
  })
})
