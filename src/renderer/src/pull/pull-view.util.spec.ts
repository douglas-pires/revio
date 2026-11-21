import type { AskThread } from '@shared/claude.types.ts'
import { describe, expect, it } from 'vitest'
import {
  appendSummaryLine,
  askHistory,
  buildDraftFromAsk,
  hasSummaryLine,
  keepNewSideOnly,
  markAsAi,
  quoteOf,
  readFileTarget,
  replyIdOf,
  toggleBetween,
} from './pull-view.util.ts'

const QUOTE = { kind: 'comment', author: 'bo', authorAvatar: '', body: 'hi', url: '', createdAt: '' } as const
const makeThread = (over: Partial<AskThread> = {}): AskThread => ({
  id: 't',
  path: 'a.ts',
  side: 'RIGHT',
  startLine: 3,
  endLine: 3,
  snippet: '',
  messages: [],
  createdAt: '',
  ...over,
})

describe('targets', () => {
  it('tells a conversation quote from a place in the diff', () => {
    expect(quoteOf({ conversation: QUOTE })).toBe(QUOTE)
    expect(readFileTarget({ conversation: QUOTE })).toBeUndefined()
    expect(readFileTarget({ path: 'a.ts', line: 3 })).toEqual({ path: 'a.ts', line: 3 })
    expect(quoteOf(undefined)).toBeNull()
  })

  it('opens a reply only when asked to', () => {
    expect(replyIdOf({ path: 'a.ts', line: 3, commentId: 9, reply: true })).toBe(9)
    expect(replyIdOf({ path: 'a.ts', line: 3, commentId: 9 })).toBeNull()
  })
})

describe('small helpers', () => {
  it('adds summary bullets', () => {
    expect(appendSummaryLine('', 'a')).toBe('- a')
    expect(appendSummaryLine('- a', 'b')).toBe('- a\n- b')
  })

  it('does not add a summary bullet twice', () => {
    expect(appendSummaryLine('- a\n- b', 'a')).toBe('- a\n- b')
    expect(hasSummaryLine('- a\n- b', 'b')).toBe(true)
    expect(hasSummaryLine('- ab', 'a')).toBe(false)
  })

  it('keeps only new-side lines', () => {
    expect(keepNewSideOnly('RIGHT', 4)).toBe(4)
    expect(keepNewSideOnly('LEFT', 4)).toBeNull()
  })

  it('drafts from a conversation, with a start line only for ranges', () => {
    expect(buildDraftFromAsk(makeThread(), 'x')).toEqual({ path: 'a.ts', side: 'RIGHT', line: 3, body: '🤖 x' })
    expect(buildDraftFromAsk(makeThread({ startLine: 1 }), 'x')).toMatchObject({ startLine: 1 })
  })

  it('marks a comment Claude wrote with a robot, once', () => {
    expect(markAsAi('Retries skip status 0.')).toBe('🤖 Retries skip status 0.')
    expect(markAsAi(markAsAi('Retries skip status 0.'))).toBe('🤖 Retries skip status 0.')
  })

  it('lists an unsaved conversation first', () => {
    const saved = [makeThread({ id: 's' })]
    expect(askHistory(makeThread(), saved).map((savedThread) => savedThread.id)).toEqual(['t', 's'])
    expect(
      askHistory(makeThread({ messages: [{ role: 'user', content: 'q' }] }), saved).map(
        (savedThread) => savedThread.id,
      ),
    ).toEqual(['s'])
  })

  it('toggles between two states', () => {
    expect(toggleBetween('open', ['open', 'closed'])).toBe('closed')
    expect(toggleBetween('closed', ['open', 'closed'])).toBe('open')
  })
})
