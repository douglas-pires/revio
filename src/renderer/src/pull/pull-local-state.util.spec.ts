import type { AskThread } from '@shared/claude.types.ts'
import type { DraftComment } from '@shared/pull.types.ts'
import { describe, expect, it } from 'vitest'
import { saveThread, setViewed, updateDraftBody } from './pull-local-state.util.ts'

const makeDraft = (id: string): DraftComment => ({ id, path: 'a.ts', line: 1, side: 'RIGHT', body: id })
function makeThread(id: string, asked: boolean): AskThread {
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
    expect(
      updateDraftBody([makeDraft('a'), makeDraft('b')], 'b', 'new').map((updatedDraft) => updatedDraft.body),
    ).toEqual(['a', 'new'])
  })

  it('marks and unmarks viewed files', () => {
    expect(setViewed({}, 'a.ts', 'sha')).toEqual({ 'a.ts': 'sha' })
    expect(setViewed({ 'a.ts': 'sha' }, 'a.ts', null)).toEqual({})
  })

  it('keeps asked conversations first and drops unasked ones', () => {
    expect(saveThread([makeThread('a', true)], makeThread('b', true)).map((savedThread) => savedThread.id)).toEqual([
      'b',
      'a',
    ])
    expect(
      saveThread([makeThread('a', true), makeThread('b', true)], makeThread('b', false)).map(
        (savedThread) => savedThread.id,
      ),
    ).toEqual(['a'])
  })
})
