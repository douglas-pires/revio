import { describe, expect, it } from 'vitest'
import { findTrigger } from './text-trigger.util.ts'

const findAtEnd = (text: string) => findTrigger(text, text.length, [':', '@'])

describe('findTrigger', () => {
  it('finds what is being typed at the caret', () => {
    expect(findAtEnd('Nice :smi')).toEqual({ character: ':', query: 'smi', start: 5 })
    expect(findAtEnd('@acme/web')).toEqual({ character: '@', query: 'acme/web', start: 0 })
    expect(findAtEnd('(:')).toEqual({ character: ':', query: '', start: 1 })
    expect(findTrigger('see :ta and more', 7, [':'])).toEqual({ character: ':', query: 'ta', start: 4 })
  })

  it('ignores the characters inside words, times, links and emails', () => {
    expect(findAtEnd('at 10:30')).toBeNull()
    expect(findAtEnd('https:/')).toBeNull()
    expect(findAtEnd('ana@acme')).toBeNull()
    expect(findAtEnd('Note:')).toBeNull()
  })

  it('stops at a space, and for characters not asked for', () => {
    expect(findAtEnd(':smile now')).toBeNull()
    expect(findTrigger('@ana', 4, [':'])).toBeNull()
  })
})
