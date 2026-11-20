import type { AskActivity } from '@shared/claude.types.ts'
import { describe, expect, it } from 'vitest'
import { answerStream } from './ask-activity.util.ts'

function record() {
  const seen: (AskActivity | { kind: 'text'; text: string })[] = []
  const stream = answerStream({ onText: (text) => seen.push({ kind: 'text', text }), onActivity: (a) => seen.push(a) })
  return { seen, stream }
}

describe('answerStream', () => {
  it('marks thinking, passes the reasoning on, then marks writing before the first words', () => {
    const { seen, stream } = record()
    stream.thinking('Status 0 ')
    stream.thinking('is a timeout.')
    stream.text('Yes, ')
    stream.text('it is.')
    expect(seen).toEqual([
      { kind: 'step', label: 'Thinking' },
      { kind: 'thinking', text: 'Status 0 ' },
      { kind: 'thinking', text: 'is a timeout.' },
      { kind: 'step', label: 'Writing the answer' },
      { kind: 'text', text: 'Yes, ' },
      { kind: 'text', text: 'it is.' },
    ])
  })

  it('goes straight to writing when no reasoning is shown', () => {
    const { seen, stream } = record()
    stream.text('Yes.')
    expect(seen).toEqual([
      { kind: 'step', label: 'Writing the answer' },
      { kind: 'text', text: 'Yes.' },
    ])
  })
})
