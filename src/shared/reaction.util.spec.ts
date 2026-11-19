import { describe, expect, it } from 'vitest'
import { applyReaction, toReactionSummaries } from './reaction.util.ts'

const group = (content: string, totalCount: number, viewerHasReacted = false) => ({
  content,
  viewerHasReacted,
  reactors: { totalCount },
})

describe('toReactionSummaries', () => {
  it('keeps emojis with reactions, in GitHub order, and drops unknown kinds', () => {
    expect(
      toReactionSummaries([
        group('EYES', 1),
        group('THUMBS_DOWN', 0),
        group('THUMBS_UP', 3, true),
        group('NEW_KIND', 2),
      ]),
    ).toEqual([
      { content: 'THUMBS_UP', count: 3, viewerHasReacted: true },
      { content: 'EYES', count: 1, viewerHasReacted: false },
    ])
  })
})

describe('applyReaction', () => {
  const base = [{ content: 'HEART' as const, count: 2, viewerHasReacted: false }]

  it('adds a new emoji in order', () => {
    expect(applyReaction(base, 'THUMBS_UP', true)).toEqual([
      { content: 'THUMBS_UP', count: 1, viewerHasReacted: true },
      ...base,
    ])
  })

  it('counts your reaction on an existing emoji, and takes it back', () => {
    const on = applyReaction(base, 'HEART', true)
    expect(on).toEqual([{ content: 'HEART', count: 3, viewerHasReacted: true }])
    expect(applyReaction(on, 'HEART', false)).toEqual(base)
  })

  it('removes the emoji when your reaction was the only one', () => {
    expect(applyReaction([{ content: 'EYES', count: 1, viewerHasReacted: true }], 'EYES', false)).toEqual([])
  })

  it('changes nothing when your reaction is already in that state', () => {
    expect(applyReaction(base, 'HEART', false)).toEqual(base)
  })
})
