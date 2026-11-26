import { describe, expect, it } from 'vitest'
import { makeDetail, makeFile } from '../../../test/fixtures.ts'
import { buildLessonPrompt } from './miss-lesson.service.ts'

describe('buildLessonPrompt', () => {
  it('sends both PRs, the approved one first', () => {
    const original = makeDetail({
      number: 10,
      title: 'feat: checkout',
      files: [makeFile({ path: 'cart.ts', patch: '+total' })],
    })
    const fix = makeDetail({
      number: 12,
      title: 'fix: total',
      files: [makeFile({ path: 'cart.ts', patch: '+round(total)' })],
    })
    const prompt = buildLessonPrompt(original, fix)
    expect(prompt.indexOf('feat: checkout')).toBeLessThan(prompt.indexOf('fix: total'))
    expect(prompt).toContain('+round(total)')
  })
})
