import { describe, expect, it } from 'vitest'
import { appendGuideEntry } from './guide-entry.util.ts'

describe('appendGuideEntry', () => {
  it('starts the section when the guide has none', () => {
    expect(appendGuideEntry('## Focus on\n- Tests\n', 'Handle request errors')).toBe(
      '## Focus on\n- Tests\n\n## From review comments\n- Handle request errors\n',
    )
  })

  it('adds to the end of the section, before the next one', () => {
    const body = '## From review comments\n- First\n\n## Safe to skip\n- Lockfiles\n'
    expect(appendGuideEntry(body, 'Second')).toBe(
      '## From review comments\n- First\n- Second\n\n## Safe to skip\n- Lockfiles\n',
    )
  })

  it('keeps a comment of several lines as one bullet', () => {
    expect(appendGuideEntry('', 'Handle errors.\n\nThe page goes blank otherwise.')).toBe(
      '## From review comments\n- Handle errors. The page goes blank otherwise.\n',
    )
  })
})
