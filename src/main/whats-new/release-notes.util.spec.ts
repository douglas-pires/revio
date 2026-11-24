import { describe, expect, it } from 'vitest'
import { parseReleaseNotes } from './release-notes.util.ts'

const RELEASE = { version: '0.3.0', publishedAt: '2026-11-25T10:00:00Z', url: 'https://x' }
const readTexts = (changes: readonly { text: string }[]) => changes.map(({ text }) => text)

describe('parseReleaseNotes', () => {
  it('sorts commits by what they mean to someone using Revio', () => {
    const notes = parseReleaseNotes(
      RELEASE,
      '- feat: copy the branch name\n- fix(inbox): keep the search\n- perf: draw faster\n- chore: bump version\n- ci: check titles',
    )
    expect(readTexts(notes.features)).toEqual(['Copy the branch name', 'Draw faster'])
    expect(notes.fixes).toEqual([{ text: 'Keep the search', scope: 'inbox', breaking: false }])
    expect(readTexts(notes.others)).toEqual(['Bump version', 'Check titles'])
  })

  it('keeps lines that name no type, and shows a breaking change of any type', () => {
    const notes = parseReleaseNotes(RELEASE, '- Bump version to 0.3.0\n- refactor!: drop the Log screen')
    expect(readTexts(notes.others)).toEqual(['Bump version to 0.3.0'])
    expect(notes.features).toEqual([{ text: 'Drop the Log screen', scope: null, breaking: true }])
  })

  it('keeps what was written by hand apart from the list', () => {
    const notes = parseReleaseNotes(RELEASE, 'A **big** one.\r\n\r\n- feat: palette\r\n')
    expect(notes.introduction).toBe('A **big** one.')
    expect(readTexts(notes.features)).toEqual(['Palette'])
  })

  it('lists a repeated line once', () => {
    expect(parseReleaseNotes(RELEASE, '- feat: palette\n- feat: palette').features).toHaveLength(1)
  })

  it('reads an empty body', () => {
    expect(parseReleaseNotes(RELEASE, '')).toEqual({
      ...RELEASE,
      introduction: '',
      features: [],
      fixes: [],
      others: [],
    })
  })
})
