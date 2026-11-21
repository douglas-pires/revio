import type { AskThread } from '@shared/claude.types.ts'
import type { DraftComment } from '@shared/pull.types.ts'
import { describe, expect, it } from 'vitest'
import { withDraftBody, withSavedThread, withViewed } from './pull-local-state.util.ts'

const draft = (id: string): DraftComment => ({ id, path: 'a.ts', line: 1, side: 'RIGHT', body: id })
function thread(id: string, asked: boolean): AskThread {
  const askThread: AskThread = {
    id,
    path: 'a.ts',
    side: 'RIGHT',
    startLine: 1,
    endLine: 1,
    snippet: '',
    messages: [],
    createdAt: '',
  }
  if (asked) {
    askThread.messages.push({ role: 'user', content: 'q' })
  }
  return askThread
}

describe('pull local state updates', () => {
  it('replaces one draft body', () => {
    expect(withDraftBody([draft('a'), draft('b')], 'b', 'new').map((updatedDraft) => updatedDraft.body)).toEqual([
      'a',
      'new',
    ])
  })

  it('marks and unmarks viewed files', () => {
    expect(withViewed({}, 'a.ts', 'sha')).toEqual({ 'a.ts': 'sha' })
    expect(withViewed({ 'a.ts': 'sha' }, 'a.ts', null)).toEqual({})
  })

  it('keeps asked conversations first and drops unasked ones', () => {
    expect(withSavedThread([thread('a', true)], thread('b', true)).map((savedThread) => savedThread.id)).toEqual([
      'b',
      'a',
    ])
    expect(
      withSavedThread([thread('a', true), thread('b', true)], thread('b', false)).map((savedThread) => savedThread.id),
    ).toEqual(['a'])
  })
})
