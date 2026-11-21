import { describe, expect, it } from 'vitest'
import { buildMessageText, buildQuestionText, buildSelectionBlock } from './ask-prompt.util.ts'

const sel = { path: 'src/a.ts', side: 'RIGHT' as const, startLine: 20, endLine: 22, snippet: '+a\n+b\n+c' }

describe('ask prompt', () => {
  it('writes a selection with its path, lines and side', () => {
    const block = buildSelectionBlock(sel)
    expect(block.startsWith('<selection path="src/a.ts" lines="20-22"')).toBe(true)
    expect(block).toContain('side="new side (head line numbers)"')
    expect(block.endsWith('+a\n+b\n+c\n</selection>')).toBe(true)
    expect(buildSelectionBlock({ ...sel, endLine: 20 }, 'added_selection')).toContain(
      '<added_selection path="src/a.ts" lines="20"',
    )
  })

  it('puts lines added for a question before the question', () => {
    const question = buildQuestionText({
      role: 'user',
      content: 'Same bug here?',
      context: [{ ...sel, path: 'src/b.ts' }],
    })
    expect(question.startsWith('<added_selection path="src/b.ts"')).toBe(true)
    expect(question.endsWith('\n\nSame bug here?')).toBe(true)
  })

  it('leaves questions without added lines and answers as they are', () => {
    expect(buildQuestionText({ role: 'user', content: 'Why?' })).toBe('Why?')
    expect(buildMessageText({ role: 'assistant', content: 'Because.', context: [sel] })).toBe('Because.')
  })
})
