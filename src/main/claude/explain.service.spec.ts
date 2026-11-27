import { describe, expect, it } from 'vitest'
import { makeDetail, makeFile } from '../../../test/fixtures.ts'
import { buildExplainPrompt } from './explain.service.ts'

describe('buildExplainPrompt', () => {
  const file = makeFile({ path: 'apps/web/cart.ts', patch: '@@ -1 +1 @@\n-a\n+b' })
  const pr = makeDetail({ files: [file] })

  it('sends the file whole, its diff and the files around it', () => {
    const prompt = buildExplainPrompt({
      pr,
      file,
      content: 'export const cart = []',
      neighbours: ['apps/web/checkout.ts'],
      references: ['apps/web/page.tsx'],
    })
    expect(prompt).toContain('export const cart = []')
    expect(prompt).toContain('+b')
    expect(prompt).toContain('apps/web/checkout.ts')
    expect(prompt).toContain('apps/web/page.tsx')
  })

  it('says when the file or its neighbours could not be read', () => {
    const prompt = buildExplainPrompt({ pr, file, content: null, neighbours: [], references: [] })
    expect(prompt).toContain('(not available: binary, too large, or removed)')
    expect(prompt).toContain('(none found)')
  })
})
