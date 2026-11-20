import type { AskThread } from '@shared/claude.types.ts'
import { describe, expect, it } from 'vitest'
import {
  askHistory,
  draftFromAsk,
  fileTargetOf,
  hasSummaryLine,
  markedAsAi,
  newSideOnly,
  quoteOf,
  replyIdOf,
  toggled,
  withSummaryLine,
} from './pull-view.util.ts'

const QUOTE = { kind: 'comment', author: 'bo', authorAvatar: '', body: 'hi', url: '', createdAt: '' } as const
const thread = (over: Partial<AskThread> = {}): AskThread => ({
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
    expect(fileTargetOf({ conversation: QUOTE })).toBeUndefined()
    expect(fileTargetOf({ path: 'a.ts', line: 3 })).toEqual({ path: 'a.ts', line: 3 })
    expect(quoteOf(undefined)).toBeNull()
  })

  it('opens a reply only when asked to', () => {
    expect(replyIdOf({ path: 'a.ts', line: 3, commentId: 9, reply: true })).toBe(9)
    expect(replyIdOf({ path: 'a.ts', line: 3, commentId: 9 })).toBeNull()
  })
})

describe('small helpers', () => {
  it('adds summary bullets', () => {
    expect(withSummaryLine('', 'a')).toBe('- a')
    expect(withSummaryLine('- a', 'b')).toBe('- a\n- b')
  })

  it('does not add a summary bullet twice', () => {
    expect(withSummaryLine('- a\n- b', 'a')).toBe('- a\n- b')
    expect(hasSummaryLine('- a\n- b', 'b')).toBe(true)
    expect(hasSummaryLine('- ab', 'a')).toBe(false)
  })

  it('keeps only new-side lines', () => {
    expect(newSideOnly('RIGHT', 4)).toBe(4)
    expect(newSideOnly('LEFT', 4)).toBeNull()
  })

  it('drafts from a conversation, with a start line only for ranges', () => {
    expect(draftFromAsk(thread(), 'x')).toEqual({ path: 'a.ts', side: 'RIGHT', line: 3, body: '🤖 x' })
    expect(draftFromAsk(thread({ startLine: 1 }), 'x')).toMatchObject({ startLine: 1 })
  })

  it('marks a comment Claude wrote with a robot, once', () => {
    expect(markedAsAi('Retries skip status 0.')).toBe('🤖 Retries skip status 0.')
    expect(markedAsAi(markedAsAi('Retries skip status 0.'))).toBe('🤖 Retries skip status 0.')
  })

  it('lists an unsaved conversation first', () => {
    const saved = [thread({ id: 's' })]
    expect(askHistory(thread(), saved).map((t) => t.id)).toEqual(['t', 's'])
    expect(askHistory(thread({ messages: [{ role: 'user', content: 'q' }] }), saved).map((t) => t.id)).toEqual(['s'])
  })

  it('toggles between two states', () => {
    expect(toggled('open', ['open', 'closed'])).toBe('closed')
    expect(toggled('closed', ['open', 'closed'])).toBe('open')
  })
})
